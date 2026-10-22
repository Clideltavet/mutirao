-- Incremental: existing payloads, identities, passwords and audit remain untouched.
CREATE TABLE IF NOT EXISTS shared_record_versions (
  id BIGSERIAL PRIMARY KEY, kind TEXT NOT NULL, record_key TEXT NOT NULL,
  payload JSONB NOT NULL, saved_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE OR REPLACE FUNCTION delta_date(v text) RETURNS timestamptz
LANGUAGE plpgsql AS $$ BEGIN RETURN v::timestamptz;
EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;
CREATE OR REPLACE FUNCTION delta_array(v jsonb) RETURNS jsonb
LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN jsonb_typeof(v)='array' THEN v ELSE '[]'::jsonb END $$;
CREATE OR REPLACE FUNCTION delta_key(k text, p jsonb) RETURNS text
LANGUAGE sql IMMUTABLE AS $$ SELECT COALESCE(NULLIF(p->>'id',''), CASE k
 WHEN 'patients' THEN COALESCE(p->>'number','sem-ficha') || '::' || COALESCE(p->>'createdAt','sem-data')
 WHEN 'clients' THEN CASE
  WHEN regexp_replace(COALESCE(p->>'cpf',''),'\D','','g') <> '' THEN 'cpf:'||regexp_replace(p->>'cpf','\D','','g')
  WHEN regexp_replace(COALESCE(p->>'phone',''),'\D','','g') <> '' THEN 'phone:'||regexp_replace(p->>'phone','\D','','g')
  ELSE 'name:'||lower(trim(COALESCE(p->>'name',''))) END
 WHEN 'procedures' THEN lower(trim(p->>'name'))
 ELSE COALESCE(p->>'at','')||':'||COALESCE(p->>'action','')||':'||COALESCE(p->>'patientNumber','') END) $$;

-- Every writer uses the same transaction-scoped lock. It covers allocation,
-- import, settings, deletion and snapshot, including retries on separate servers.
CREATE OR REPLACE FUNCTION delta_apply(mode text, body jsonb, actor jsonb DEFAULT '{}'::jsonb)
RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE s jsonb; n bigint; rev bigint; epoch timestamptz; p jsonb; old jsonb;
 k text; rk text; field text; d jsonb; v timestamptz; ov timestamptz;
 result jsonb; patient jsonb; stamp timestamptz; audit jsonb; events jsonb;
BEGIN
 PERFORM pg_advisory_xact_lock(174, 501);
 stamp := clock_timestamp();
 SELECT value INTO s FROM system_state WHERE key='nextPatientNumber' FOR UPDATE;
 IF s IS NULL THEN
  SELECT COALESCE(max(CASE WHEN payload->>'number' ~ '^[0-9]{1,9}$' THEN (payload->>'number')::bigint END),0)+1
    INTO n FROM shared_records WHERE kind='patients';
  s := jsonb_build_object('value',n,'epoch','1970-01-01T00:00:00Z','revision',0);
 ELSIF jsonb_typeof(s) <> 'object' THEN
  s := jsonb_build_object('value',s,'epoch','1970-01-01T00:00:00Z','revision',0);
 END IF;
 n := GREATEST(1,(s->>'value')::bigint);
 rev := COALESCE((s->>'revision')::bigint,0);
 epoch := COALESCE(delta_date(s->>'epoch'),'1970-01-01'::timestamptz);
 IF mode='configure' THEN
  n := (body->>'nextPatientNumber')::bigint;
  IF n < 1 OR n > 99999999 THEN RAISE EXCEPTION 'Ficha inválida'; END IF;
  epoch := stamp;
  s := s || jsonb_build_object('epoch',epoch,'source','manual','changedBy',actor->>'username');
  audit := jsonb_build_object('id','sequence-'||gen_random_uuid()::text,'at',stamp,
   'action','SEQUENCIA_ALTERADA','actionLabel','Sequência alterada','category','CONFIGURACAO',
   'actorName',actor->>'name','actorUsername',actor->>'username','details','Próxima ficha: '||n);
  INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES('audit',audit->>'id',audit,stamp);
 END IF;
 IF mode IN ('sync','tv') THEN
  -- Tombstones are permanent. Client clocks never authorize resurrection.
  FOR d IN SELECT value FROM jsonb_array_elements(CASE WHEN mode='tv' THEN '[]'::jsonb ELSE COALESCE(body->'deletions','[]') END) LOOP
   k:=d->>'kind'; rk:=d->>'recordKey';
   IF k NOT IN ('patients','clients','procedures') OR rk IS NULL THEN CONTINUE; END IF;
   INSERT INTO shared_tombstones VALUES(k,rk,stamp) ON CONFLICT DO NOTHING;
   INSERT INTO shared_record_versions(kind,record_key,payload) SELECT kind,record_key,payload FROM shared_records WHERE kind=k AND record_key=rk;
   DELETE FROM shared_records WHERE kind=k AND record_key=rk;
  END LOOP;
  FOR field,k IN SELECT * FROM (VALUES ('patients','patients'),('clients','clients'),('procedures','procedures'),('auditLog','audit')) AS defs(f,t) LOOP
   FOR p IN SELECT value FROM jsonb_array_elements(COALESCE(body->field,'[]')) LOOP
    IF jsonb_typeof(p)<>'object' THEN CONTINUE; END IF;
    rk:=delta_key(k,p); IF k='procedures' THEN rk:=lower(trim(rk)); END IF;
    IF rk IS NULL OR EXISTS(SELECT 1 FROM shared_tombstones WHERE kind=k AND record_key=rk) THEN CONTINUE; END IF;
    SELECT payload,version_time INTO old,ov FROM shared_records WHERE kind=k AND record_key=rk;
    IF mode='tv' THEN
     IF k='patients' THEN
      IF old IS NULL THEN CONTINUE; END IF;
      SELECT COALESCE(jsonb_agg(value),'[]') INTO events FROM jsonb_array_elements(delta_array(p->'timeline')) WHERE value->>'type' IN ('CIRURGIA_CONFIRMADA','ALTA');
      p:=old || (SELECT COALESCE(jsonb_object_agg(key,value),'{}') FROM jsonb_each(p) WHERE key IN ('status','veterinarian','surgeryExtras','surgeryNotes','confirmedAt','_syncUpdatedAt','dischargeStatus','dischargedAt','dischargeVeterinarian','dischargeNotes')) || jsonb_build_object('timeline',events);
     ELSIF k='audit' THEN
      IF p->>'action' NOT IN ('CIRURGIA_CONFIRMADA','ALTA') THEN CONTINUE; END IF;
     ELSE CONTINUE;
     END IF;
    END IF;
    v:=COALESCE(delta_date(p->>'_syncUpdatedAt'),delta_date(p->>'updatedAt'),delta_date(p->>'at'),delta_date(p->>'createdAt'),'1970-01-01');
    IF old IS NOT NULL AND old=p THEN CONTINUE; END IF;
    IF old IS NOT NULL THEN
     -- Keep both revisions for recovery, including offline conflicting edits.
     INSERT INTO shared_record_versions(kind,record_key,payload) VALUES(k,rk,p);
     IF k='audit' THEN CONTINUE; END IF;
     IF k='patients' THEN
      SELECT COALESCE(jsonb_agg(e ORDER BY e->>'at'),'[]') INTO events FROM
       (SELECT DISTINCT value AS e FROM jsonb_array_elements(delta_array(old->'timeline')||delta_array(p->'timeline'))) u;
      IF v<=ov THEN p:=old||jsonb_build_object('timeline',events);
      ELSE p:=p||jsonb_build_object('timeline',events,'number',old->'number','createdAt',old->'createdAt'); END IF;
     ELSIF v<=ov THEN CONTINUE;
     END IF;
     INSERT INTO shared_record_versions(kind,record_key,payload) VALUES(k,rk,old);
    END IF;
    INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES(k,rk,p,v)
    ON CONFLICT(kind,record_key) DO UPDATE SET payload=EXCLUDED.payload,version_time=GREATEST(shared_records.version_time,EXCLUDED.version_time),server_updated_at=stamp;
   END LOOP;
  END LOOP;
 END IF;
 -- Include legacy local imports without changing their numbers. Old epochs do
 -- not undo an explicit reset. Browser nextPatientNumber is never authoritative.
 IF mode<>'configure' THEN
  SELECT GREATEST(n,COALESCE(max(CASE WHEN payload->>'number' ~ '^[0-9]{1,9}$' THEN (payload->>'number')::bigint END)+1,n))
   INTO n FROM shared_records WHERE kind='patients' AND delta_date(payload->>'createdAt')>=epoch;
 END IF;
 IF mode='create' THEN
  p:=body->'patient'; rk:=p->>'id';
  IF rk IS NULL OR length(rk)>100 THEN RAISE EXCEPTION 'ID obrigatório'; END IF;
  IF EXISTS(SELECT 1 FROM shared_tombstones WHERE kind='patients' AND record_key=rk) THEN RAISE EXCEPTION 'Registro excluído'; END IF;
  SELECT payload INTO patient FROM shared_records WHERE kind='patients' AND record_key=rk;
  IF patient IS NULL THEN
   patient:=p||jsonb_build_object('number',n,'createdAt',stamp,'_syncUpdatedAt',stamp,'createdBy',actor,
     'timeline',jsonb_build_array(jsonb_build_object('type','ENTRADA_CRIADA','at',stamp,'actor',actor,'notes','Paciente cadastrado na entrada.')));
   IF p->>'location'='Caixa' AND COALESCE((body->>'autoLocation')::boolean,false) THEN
    patient:=patient||jsonb_build_object('locationNumber',lpad(n::text,GREATEST(3,length(n::text)),'0'));
   END IF;
   INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES('patients',rk,patient,stamp);
   audit:=jsonb_build_object('id','entry-'||rk,'at',stamp,'action','ENTRADA_CRIADA','actionLabel','Entrada cadastrada','category','PACIENTE',
    'actorId',actor->>'id','actorName',actor->>'name','actorUsername',actor->>'username','actorType','FUNCIONARIO',
    'patientNumber',n,'patientName',patient->>'patientName','tutorName',patient->>'tutorName','details','Entrada confirmada no Neon');
   INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES('audit',audit->>'id',audit,stamp);
   n:=n+1;
  END IF;
 END IF;
 IF n<>(s->>'value')::bigint OR mode='configure' THEN rev:=rev+1; END IF;
 s:=s||jsonb_build_object('value',n,'revision',rev,'epoch',epoch);
 INSERT INTO system_state(key,value,updated_at) VALUES('nextPatientNumber',s,stamp)
 ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=CASE WHEN system_state.value<>EXCLUDED.value THEN stamp ELSE system_state.updated_at END;
 result:=jsonb_build_object('nextPatientNumber',n,'sequenceRevision',rev,'sequenceEpoch',epoch,'syncedAt',stamp);
 IF mode='create' THEN RETURN result||jsonb_build_object('patient',patient); END IF;
 IF mode='configure' OR mode='sequence' THEN RETURN result; END IF;
 FOR field,k IN SELECT * FROM (VALUES ('patients','patients'),('clients','clients'),('procedures','procedures'),('auditLog','audit')) AS defs(f,t) LOOP
  result:=result||jsonb_build_object(field,COALESCE((SELECT jsonb_agg(payload ORDER BY server_updated_at) FROM shared_records WHERE kind=k),'[]'::jsonb));
 END LOOP;
 RETURN result||jsonb_build_object('deletions',COALESCE((SELECT jsonb_agg(jsonb_build_object('kind',kind,'recordKey',record_key,'at',deleted_at)) FROM shared_tombstones),'[]'::jsonb));
END $$;
