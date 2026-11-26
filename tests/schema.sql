CREATE TABLE roles(id text PRIMARY KEY,name text UNIQUE NOT NULL,description text NOT NULL DEFAULT '',accesses jsonb NOT NULL DEFAULT '[]',created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE users(id text PRIMARY KEY,name text NOT NULL,username text UNIQUE NOT NULL,password_hash text NOT NULL,role_id text REFERENCES roles(id),accesses jsonb NOT NULL DEFAULT '[]',active boolean NOT NULL DEFAULT true,created_at timestamptz DEFAULT now(),updated_at timestamptz DEFAULT now());
CREATE TABLE sessions(id text PRIMARY KEY,user_id text NOT NULL REFERENCES users(id) ON DELETE CASCADE,token_hash text UNIQUE NOT NULL,expires_at timestamptz NOT NULL,created_at timestamptz DEFAULT now());
CREATE TABLE shared_records(kind text NOT NULL,record_key text NOT NULL,payload jsonb NOT NULL,version_time timestamptz NOT NULL,server_updated_at timestamptz NOT NULL DEFAULT now(),PRIMARY KEY(kind,record_key));
CREATE TABLE shared_tombstones(kind text NOT NULL,record_key text NOT NULL,deleted_at timestamptz NOT NULL,PRIMARY KEY(kind,record_key));
CREATE TABLE system_state(key text PRIMARY KEY,value jsonb NOT NULL,updated_at timestamptz NOT NULL DEFAULT now());
