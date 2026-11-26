-- Apply only AFTER verified backup and isolated rehearsal. No patient payload is
-- changed by this migration. Existing tombstones remain effective.
CREATE TABLE IF NOT EXISTS delta_record_meta (
 kind text NOT NULL, record_key text NOT NULL, revision bigint NOT NULL DEFAULT 0,
 deleted_at timestamptz, PRIMARY KEY(kind,record_key)
);
CREATE TABLE IF NOT EXISTS delta_history (
 id bigserial PRIMARY KEY, kind text NOT NULL, record_key text NOT NULL,
 before_payload jsonb, after_payload jsonb, actor jsonb NOT NULL,
 action text NOT NULL, reason text, request_id text NOT NULL,
 saved_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS delta_requests (
 request_id text PRIMARY KEY, actor_id text NOT NULL, command jsonb NOT NULL,
 response jsonb NOT NULL, created_at timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS delta_allocations (
 epoch text NOT NULL, number bigint NOT NULL, record_key text NOT NULL UNIQUE,
 PRIMARY KEY(epoch,number)
);
CREATE TABLE IF NOT EXISTS delta_devices (
 token_hash text PRIMARY KEY, name text NOT NULL, created_by text NOT NULL,
 expires_at timestamptz NOT NULL, revoked_at timestamptz
);
CREATE TABLE IF NOT EXISTS delta_login_limits (
 key text PRIMARY KEY, attempts integer NOT NULL, window_start timestamptz NOT NULL
);
CREATE TABLE IF NOT EXISTS delta_schema_versions (version integer PRIMARY KEY, installed_at timestamptz NOT NULL DEFAULT now());
CREATE OR REPLACE FUNCTION delta2_date(v text) RETURNS timestamptz LANGUAGE plpgsql AS $$
BEGIN RETURN v::timestamptz; EXCEPTION WHEN OTHERS THEN RETURN NULL; END $$;

CREATE OR REPLACE FUNCTION delta2_array(v jsonb) RETURNS jsonb LANGUAGE sql IMMUTABLE AS $$ SELECT CASE WHEN jsonb_typeof(v)='array' THEN v ELSE '[]'::jsonb END $$;

-- Blocks obsolete deployments that still push snapshots. This is deliberate:
-- rolling back to the unsafe writer is prohibited. No data is deleted.
CREATE OR REPLACE FUNCTION delta2_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('delta.confirmed_writer',true) IS DISTINCT FROM 'on' THEN
  RAISE EXCEPTION 'Legacy writer disabled: use confirmed operations' USING ERRCODE='42501';
 END IF;
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Physical deletion disabled' USING ERRCODE='42501'; END IF;
 RETURN NEW;
END $$;
DO $$ BEGIN
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='delta2_records_guard') THEN
  CREATE TRIGGER delta2_records_guard BEFORE INSERT OR UPDATE OR DELETE ON shared_records FOR EACH ROW EXECUTE FUNCTION delta2_guard();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='delta2_state_guard') THEN
  CREATE TRIGGER delta2_state_guard BEFORE INSERT OR UPDATE OR DELETE ON system_state FOR EACH ROW EXECUTE FUNCTION delta2_guard();
 END IF;
 IF NOT EXISTS(SELECT 1 FROM pg_trigger WHERE tgname='delta2_tombstone_guard') THEN
  CREATE TRIGGER delta2_tombstone_guard BEFORE INSERT OR UPDATE OR DELETE ON shared_tombstones FOR EACH ROW EXECUTE FUNCTION delta2_guard();
 END IF;
END $$;

CREATE OR REPLACE FUNCTION delta2_apply(cmd jsonb, actor jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE op text:=cmd->>'op'; k text:=cmd->>'kind'; rk text:=cmd->>'key';
 rid text:=cmd->>'requestId'; aid text:=actor->>'id'; acc jsonb:=COALESCE(actor->'accesses','[]');
 prior delta_requests%ROWTYPE; old jsonb; p jsonb; rev bigint; glob bigint;
 state jsonb; n bigint; sr bigint; v_epoch text; stamp timestamptz:=clock_timestamp();
 result jsonb; event jsonb; audit jsonb; details jsonb; proc text; price numeric; total numeric;
 allowed text[]; action text:=cmd->>'action'; isadmin boolean:=COALESCE(actor->>'roleId'='admin',false);
BEGIN
 PERFORM pg_advisory_xact_lock(174,502);
 PERFORM set_config('delta.confirmed_writer','on',true);
 IF aid IS NULL THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
 SELECT COALESCE((value->>'value')::bigint,0) INTO glob FROM system_state WHERE key='deltaRevision';
 glob:=COALESCE(glob,0);
 SELECT value INTO state FROM system_state WHERE key='nextPatientNumber';
 IF state IS NULL THEN state:='{}'; END IF;
 IF jsonb_typeof(state)<>'object' THEN state:=jsonb_build_object('value',state); END IF;
 SELECT COALESCE(max(CASE WHEN payload->>'number' ~ '^[0-9]{1,8}$' THEN (payload->>'number')::bigint END),0)+1 INTO n FROM shared_records WHERE kind='patients';
 n:=COALESCE((state->>'value')::bigint,n,1);
 sr:=COALESCE((state->>'revision')::bigint,0);
 v_epoch:=COALESCE(state->>'epoch','1970-01-01T00:00:00Z');
 IF op='read' THEN
  SELECT jsonb_build_object('patients',COALESCE(jsonb_agg(payload||jsonb_build_object('_key',record_key,'_revision',revision)) FILTER(WHERE kind='patients'),'[]'),
    'clients',COALESCE(jsonb_agg(payload||jsonb_build_object('_key',record_key,'_revision',revision)) FILTER(WHERE kind='clients'),'[]'),
    'procedures',COALESCE(jsonb_agg(payload||jsonb_build_object('_key',record_key,'_revision',revision)) FILTER(WHERE kind='procedures'),'[]'),
    'auditLog',COALESCE(jsonb_agg(payload) FILTER(WHERE kind='audit'),'[]'),
    'settings',COALESCE(jsonb_object_agg(record_key,jsonb_build_object('value',payload->'value','revision',revision)) FILTER(WHERE kind='settings'),'{}')) INTO result
  FROM (SELECT r.*,COALESCE(m.revision,0) revision FROM shared_records r LEFT JOIN delta_record_meta m USING(kind,record_key)
   WHERE m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM shared_tombstones t WHERE t.kind=r.kind AND t.record_key=r.record_key)) q;
  RETURN result||jsonb_build_object('revision',glob,'nextPatientNumber',n,'sequenceRevision',sr,'syncedAt',stamp);
 END IF;
 IF rid IS NULL OR length(rid)>100 THEN RAISE EXCEPTION 'INVALID_REQUEST'; END IF;
 SELECT * INTO prior FROM delta_requests WHERE request_id=rid;
 IF FOUND THEN
  IF prior.actor_id<>aid OR prior.command<>cmd THEN RAISE EXCEPTION 'IDEMPOTENCY_CONFLICT' USING ERRCODE='40001'; END IF;
  RETURN prior.response;
 END IF;
 IF op='configure' THEN
  IF NOT acc ? 'MASTER' THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
  IF cmd->>'expectedRevision' IS NULL OR (cmd->>'expectedRevision')::bigint<>sr THEN RAISE EXCEPTION 'CONFLICT' USING ERRCODE='40001'; END IF;
  n:=(cmd->>'nextPatientNumber')::bigint;
  IF n<1 OR n>99999999 THEN RAISE EXCEPTION 'INVALID_NUMBER'; END IF;
  v_epoch:=stamp::text; sr:=sr+1;
  k:='settings';rk:='nextPatientNumber';old:=state;
  state:=state||jsonb_build_object('value',n,'revision',sr,'epoch',v_epoch,'changedBy',aid);
  p:=state;action:='SEQUENCIA_ALTERADA';
 ELSE
  IF k NOT IN ('patients','clients','procedures','settings') OR rk IS NULL OR length(rk)>250 THEN RAISE EXCEPTION 'INVALID_RECORD'; END IF;
  SELECT payload INTO old FROM shared_records WHERE kind=k AND record_key=rk;
  SELECT revision INTO rev FROM delta_record_meta WHERE kind=k AND record_key=rk;
  rev:=COALESCE(rev,0);
  IF EXISTS(SELECT 1 FROM shared_tombstones WHERE kind=k AND record_key=rk) OR EXISTS(SELECT 1 FROM delta_record_meta WHERE kind=k AND record_key=rk AND deleted_at IS NOT NULL) THEN
   RAISE EXCEPTION 'DELETED' USING ERRCODE='40001';
  END IF;
  IF cmd->>'expectedRevision' IS NULL OR (cmd->>'expectedRevision')::bigint<>rev THEN RAISE EXCEPTION 'CONFLICT' USING ERRCODE='40001'; END IF;
  IF op IN ('create','recover') AND old IS NOT NULL THEN RAISE EXCEPTION 'EXISTS' USING ERRCODE='40001'; END IF;
  IF op IN ('update','delete') AND old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='40001'; END IF;
  p:=COALESCE(old,'{}');
  IF op='recover' THEN
   IF NOT isadmin OR length(COALESCE(cmd->>'reason',''))<8 THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
   p:=cmd->'payload'; action:='REGISTRO_RECUPERADO';
   -- No overwrite, renumbering or resurrection. Deleted identities require
   -- a separately reviewed recovery under a new key, referencing the old key.
  ELSIF op='delete' THEN
   IF k='settings' OR (k='patients' AND NOT isadmin) OR (k<>'patients' AND NOT acc ? 'CADASTROS') THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
   IF length(COALESCE(cmd->>'reason',''))<8 THEN RAISE EXCEPTION 'REASON_REQUIRED'; END IF;
   action:=CASE WHEN k='patients' THEN 'REGISTRO_TESTE_EXCLUIDO' ELSE 'CADASTRO_EXCLUIDO' END;
   INSERT INTO shared_tombstones(kind,record_key,deleted_at) VALUES(k,rk,stamp);
  ELSIF k='patients' THEN
   IF op='create' THEN
    IF NOT acc ? 'ENTRADA' THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
    p:=cmd->'payload';
    WHILE EXISTS(SELECT 1 FROM delta_allocations WHERE delta_allocations.epoch=v_epoch AND number=n)
     OR EXISTS(SELECT 1 FROM shared_records WHERE kind='patients' AND payload->>'number'=n::text AND COALESCE(delta2_date(payload->>'createdAt'),server_updated_at)>=COALESCE(delta2_date(v_epoch),'1970-01-01')) LOOP n:=n+1; END LOOP;
    IF n>99999999 THEN RAISE EXCEPTION 'NUMBER_LIMIT'; END IF;
    p:=p||jsonb_build_object('id',rk,'number',n,'createdAt',stamp,'createdBy',actor,'status','AGUARDANDO','timeline','[]'::jsonb);
    IF COALESCE((cmd->>'autoLocation')::boolean,false) AND p->>'location'='Caixa' THEN p:=p||jsonb_build_object('locationNumber',lpad(n::text,GREATEST(3,length(n::text)),'0')); END IF;
    INSERT INTO delta_allocations VALUES(v_epoch,n,rk);
    n:=n+1;sr:=sr+1;action:='ENTRADA_CRIADA';
   ELSE
    IF action='PACIENTE_EDITADO' AND acc ? 'PACIENTES' THEN
     allowed:=ARRAY['patientName','species','sex','tutorName','phone','tutorCpf','tutorEmail','clientId','weight','location','locationNumber','procedures','notes'];
    ELSIF action='CIRURGIA_CONFIRMADA' AND (acc ? 'CIRURGIA' OR acc ? 'PACIENTES') THEN
     IF old->>'status'='CONFIRMADO' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
     allowed:=ARRAY['veterinarian','surgeryExtras','surgeryNotes']; p:=p||jsonb_build_object('status','CONFIRMADO','confirmedAt',stamp);
    ELSIF action='ALTA' AND (acc ? 'CIRURGIA' OR acc ? 'PACIENTES') THEN
     IF old->>'status' IS DISTINCT FROM 'CONFIRMADO' OR COALESCE(old->>'dischargeStatus','')<>'' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
     allowed:=ARRAY['dischargeVeterinarian','dischargeNotes'];p:=p||jsonb_build_object('dischargeStatus','ALTA','dischargedAt',stamp);
    ELSIF action='ENTREGUE' AND acc ? 'SAIDA' THEN
     IF old->>'dischargeStatus' IS DISTINCT FROM 'ALTA' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
     allowed:=ARRAY['deliveryNotes'];p:=p||jsonb_build_object('dischargeStatus','ENTREGUE','deliveredAt',stamp);
    ELSIF action='ALTA_CANCELADA' AND acc ? 'SAIDA' THEN
     IF old->>'dischargeStatus' IS DISTINCT FROM 'ALTA' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
     allowed:=ARRAY['returnedToInternedNotes'];p:=p||jsonb_build_object('dischargeStatus',null,'returnedToInternedAt',stamp);
    ELSIF action='REINTERNADO_APOS_ENTREGA' AND acc ? 'SAIDA' THEN
     IF old->>'dischargeStatus' IS DISTINCT FROM 'ENTREGUE' THEN RAISE EXCEPTION 'INVALID_TRANSITION'; END IF;
     allowed:=ARRAY['location','locationNumber','reinternedNotes'];p:=p||jsonb_build_object('dischargeStatus',null,'reinternedAt',stamp);
    ELSE RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
    IF EXISTS(SELECT 1 FROM jsonb_object_keys(cmd->'payload') key WHERE NOT key=ANY(allowed)) THEN RAISE EXCEPTION 'FIELD_FORBIDDEN' USING ERRCODE='42501'; END IF;
    p:=p||(cmd->'payload');
   END IF;
   IF op='create' OR (action='PACIENTE_EDITADO' AND p->'procedures' IS DISTINCT FROM old->'procedures') THEN
    details:='[]';total:=0;
    FOR proc IN SELECT jsonb_array_elements_text(COALESCE(p->'procedures','[]')) LOOP
     SELECT (value->>'value')::numeric INTO price FROM jsonb_array_elements(delta2_array(old->'procedureDetails')) WHERE value->>'name'=proc LIMIT 1;
     IF price IS NULL THEN
      SELECT (r.payload->>'value')::numeric INTO price FROM shared_records r LEFT JOIN delta_record_meta m USING(kind,record_key)
       WHERE r.kind='procedures' AND r.payload->>'name'=proc AND m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM shared_tombstones t WHERE t.kind=r.kind AND t.record_key=r.record_key) LIMIT 1;
     END IF;
     IF price IS NULL OR price<0 THEN RAISE EXCEPTION 'PRICE_UNAVAILABLE'; END IF;
     price:=round(price,2);details:=details||jsonb_build_array(jsonb_build_object('name',proc,'value',price));total:=total+price;
    END LOOP;
    p:=p||jsonb_build_object('procedureDetails',details,'totalValue',total);
   END IF;
   event:=jsonb_build_object('type',action,'at',stamp,'actor',actor,'notes',COALESCE(cmd->>'reason',cmd->'payload'->>'surgeryNotes',cmd->'payload'->>'dischargeNotes',cmd->'payload'->>'deliveryNotes',''));
   p:=p||jsonb_build_object('timeline',delta2_array(p->'timeline')||jsonb_build_array(event),'updatedAt',stamp);
  ELSIF k='clients' THEN
   IF NOT (acc ? 'CADASTROS' OR (op='create' AND acc ? 'ENTRADA')) THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
   p:=p||(cmd->'payload'); action:=CASE WHEN op='create' THEN 'CLIENTE_CADASTRADO' ELSE 'CLIENTE_EDITADO' END;
  ELSE
   IF NOT acc ? 'CADASTROS' THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
   p:=p||(cmd->'payload');action:='CADASTRO_ATUALIZADO';
  END IF;
  IF k IN ('clients','procedures') AND op IN ('create','update') THEN
   IF op='create' THEN p:=p||jsonb_build_object('id',rk,'createdAt',stamp); ELSE p:=p||jsonb_build_object('id',old->'id','createdAt',old->'createdAt'); END IF;
   IF k='procedures' AND EXISTS(SELECT 1 FROM shared_records r LEFT JOIN delta_record_meta m USING(kind,record_key) WHERE r.kind=k AND r.record_key<>rk AND lower(trim(r.payload->>'name'))=lower(trim(p->>'name')) AND m.deleted_at IS NULL AND NOT EXISTS(SELECT 1 FROM shared_tombstones t WHERE t.kind=r.kind AND t.record_key=r.record_key)) THEN RAISE EXCEPTION 'DUPLICATE_CATALOG' USING ERRCODE='40001'; END IF;
  END IF;
  IF op NOT IN ('create','update','delete','recover') THEN RAISE EXCEPTION 'INVALID_OPERATION'; END IF;
  IF op<>'delete' THEN
   INSERT INTO shared_records(kind,record_key,payload,version_time,server_updated_at) VALUES(k,rk,p,stamp,stamp)
    ON CONFLICT(kind,record_key) DO UPDATE SET payload=EXCLUDED.payload,version_time=stamp,server_updated_at=stamp;
  END IF;
  rev:=rev+1;
  INSERT INTO delta_record_meta(kind,record_key,revision,deleted_at) VALUES(k,rk,rev,CASE WHEN op='delete' THEN stamp END)
   ON CONFLICT(kind,record_key) DO UPDATE SET revision=EXCLUDED.revision,deleted_at=EXCLUDED.deleted_at;
 END IF;
 IF op='configure' OR (op='create' AND k='patients') THEN
  state:=state||jsonb_build_object('value',n,'revision',sr,'epoch',v_epoch);
  INSERT INTO system_state VALUES('nextPatientNumber',state,stamp) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=stamp;
 END IF;
 glob:=glob+1;
 INSERT INTO system_state VALUES('deltaRevision',jsonb_build_object('value',glob),stamp) ON CONFLICT(key) DO UPDATE SET value=EXCLUDED.value,updated_at=stamp;
 INSERT INTO delta_history(kind,record_key,before_payload,after_payload,actor,action,reason,request_id) VALUES(k,rk,old,p,actor,action,cmd->>'reason',rid);
 audit:=jsonb_build_object('id','v2-'||rid,'at',stamp,'action',action,'category',k,'actorId',aid,'actorName',actor->>'name','actorUsername',actor->>'username','actorType',COALESCE(actor->>'type','FUNCIONARIO'), 'patientNumber',CASE WHEN k='patients' THEN p->'number' END,'patientName',CASE WHEN k='patients' THEN p->>'patientName' END,'tutorName',CASE WHEN k='patients' THEN p->>'tutorName' END,'details',COALESCE(cmd->>'reason',action));
 INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES('audit',audit->>'id',audit,stamp);
 result:=jsonb_build_object('ok',true,'record',p||jsonb_build_object('_key',rk,'_revision',COALESCE(rev,0)),'revision',glob,'nextPatientNumber',n,'sequenceRevision',sr,'syncedAt',stamp);
 INSERT INTO delta_requests VALUES(rid,aid,cmd,result,stamp);
 RETURN result;
END $$;
INSERT INTO delta_schema_versions(version) VALUES(2) ON CONFLICT DO NOTHING;
ALTER TABLE users ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS revision bigint NOT NULL DEFAULT 0;
CREATE OR REPLACE FUNCTION delta2_admin(entity text, verb text, body jsonb, actor jsonb) RETURNS jsonb LANGUAGE plpgsql AS $$
DECLARE old jsonb; afterrow jsonb; target text:=body->>'id'; access jsonb:=COALESCE(body->'accesses','[]'); stamp timestamptz:=clock_timestamp();
BEGIN
 PERFORM pg_advisory_xact_lock(174,502);
 PERFORM pg_advisory_xact_lock(174,503);
 PERFORM set_config('delta.confirmed_writer','on',true);
 IF NOT (actor->'accesses') ? 'CADASTROS' THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
 IF EXISTS(SELECT 1 FROM jsonb_array_elements_text(access) a WHERE NOT (actor->'accesses') ? a) AND COALESCE(actor->>'roleId','')<>'admin' THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
 IF entity='users' THEN SELECT to_jsonb(u) INTO old FROM users u WHERE id=target FOR UPDATE;
 ELSE SELECT to_jsonb(r) INTO old FROM roles r WHERE id=target FOR UPDATE; END IF;
 IF verb<>'POST' AND old IS NULL THEN RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE='40001'; END IF;
 IF verb<>'POST' AND (body->>'expectedRevision' IS NULL OR (old->>'revision')::bigint<>(body->>'expectedRevision')::bigint) THEN RAISE EXCEPTION 'CONFLICT' USING ERRCODE='40001'; END IF;
 IF COALESCE(actor->>'roleId','')<>'admin' AND (old->>'role_id'='admin' OR target='admin' OR body->>'roleId'='admin' OR access ? 'MASTER' OR access ? 'CADASTROS' OR (body ? 'passwordHash' AND verb<>'POST') OR COALESCE(old->'accesses','[]') ? 'MASTER' OR COALESCE(old->'accesses','[]') ? 'CADASTROS') THEN RAISE EXCEPTION 'AUTH' USING ERRCODE='42501'; END IF;
 IF entity='users' THEN
  IF verb='POST' THEN
   IF EXISTS(SELECT 1 FROM users WHERE lower(username)=lower(body->>'username')) THEN RAISE EXCEPTION 'EXISTS' USING ERRCODE='40001'; END IF;
   INSERT INTO users(id,name,username,password_hash,role_id,accesses) VALUES(target,body->>'name',lower(body->>'username'),body->>'passwordHash',NULLIF(body->>'roleId',''),access);
  ELSE
   IF target=actor->>'id' AND (verb='DELETE' OR body->>'active'='false' OR body ? 'roleId' OR body ? 'accesses') THEN RAISE EXCEPTION 'SELF_LOCKOUT' USING ERRCODE='42501'; END IF;
   UPDATE users SET password_hash=COALESCE(body->>'passwordHash',password_hash),active=CASE WHEN verb='DELETE' THEN false ELSE COALESCE((body->>'active')::boolean,active) END,
    role_id=CASE WHEN body ? 'roleId' THEN NULLIF(body->>'roleId','') ELSE role_id END,
    accesses=CASE WHEN body ? 'accesses' THEN access ELSE accesses END,revision=revision+1,updated_at=stamp WHERE id=target;
   DELETE FROM sessions WHERE user_id=target;
  END IF;
  SELECT to_jsonb(u)-'password_hash' INTO afterrow FROM users u WHERE id=target;
 ELSE
  IF verb='DELETE' THEN
   IF target='admin' OR EXISTS(SELECT 1 FROM users WHERE role_id=target) THEN RAISE EXCEPTION 'ROLE_IN_USE' USING ERRCODE='40001'; END IF;
   DELETE FROM roles WHERE id=target;
  ELSIF verb='POST' THEN INSERT INTO roles(id,name,description,accesses) VALUES(target,body->>'name',COALESCE(body->>'description',''),access);
  ELSE UPDATE roles SET name=body->>'name',description=COALESCE(body->>'description',''),accesses=access,revision=revision+1,updated_at=stamp WHERE id=target; END IF;
  SELECT to_jsonb(r) INTO afterrow FROM roles r WHERE id=target;
 END IF;
 INSERT INTO delta_history(kind,record_key,before_payload,after_payload,actor,action,request_id) VALUES(entity,target,old-'password_hash',afterrow,actor,verb,'admin-'||gen_random_uuid());
 INSERT INTO shared_records(kind,record_key,payload,version_time) VALUES('audit','admin-'||gen_random_uuid(),jsonb_build_object('id','admin-'||gen_random_uuid(),'at',stamp,'action',entity||'_'||verb,'category','ADMIN','actorId',actor->>'id','actorName',actor->>'name','actorUsername',actor->>'username','actorType','FUNCIONARIO','details',entity||' '||target||' '||verb),stamp);
 INSERT INTO system_state(key,value,updated_at) VALUES('deltaRevision','{"value":1}',stamp) ON CONFLICT(key) DO UPDATE SET value=jsonb_build_object('value',(system_state.value->>'value')::bigint+1),updated_at=stamp;
 RETURN jsonb_build_object('ok',true,'record',afterrow);
END $$;
