-- Schema of the old app (score-tracker, Prisma), from pg_dump --schema-only.
-- Only for tests of the import (src/import), no data.

CREATE TYPE "GameStatus" AS ENUM (
    'ACTIVE',
    'COMPLETED',
    'CANCELLED'
);


--
-- Name: TrackerType; Type: TYPE; Schema: public; Owner: -
--

CREATE TYPE "TrackerType" AS ENUM (
    'SCHWIMMEN',
    'DURAK'
);



CREATE TABLE "Game" (
    id text NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    status "GameStatus" DEFAULT 'ACTIVE'::"GameStatus" NOT NULL,
    "trackerId" text NOT NULL,
    "gameData" jsonb NOT NULL
);

CREATE TABLE "GameParticipant" (
    id text NOT NULL,
    "displayName" text NOT NULL,
    "gameId" text NOT NULL,
    "userId" text,
    "order" integer
);

CREATE TABLE "GameRound" (
    data jsonb NOT NULL,
    round integer NOT NULL,
    "gameId" text NOT NULL
);

CREATE TABLE "Tracker" (
    id text NOT NULL,
    type "TrackerType" NOT NULL,
    "displayName" text NOT NULL,
    archived boolean DEFAULT false NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone DEFAULT CURRENT_TIMESTAMP NOT NULL,
    "creatorId" text
);

CREATE TABLE "TrackerPlayer" (
    id text NOT NULL,
    "displayName" text NOT NULL,
    "trackerId" text NOT NULL,
    "playerId" text
);

CREATE TABLE account (
    id text NOT NULL,
    "accountId" text NOT NULL,
    "providerId" text NOT NULL,
    "userId" text NOT NULL,
    "accessToken" text,
    "refreshToken" text,
    "idToken" text,
    "accessTokenExpiresAt" timestamp(3) without time zone,
    "refreshTokenExpiresAt" timestamp(3) without time zone,
    scope text,
    password text,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL
);

CREATE TABLE session (
    id text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    token text NOT NULL,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    "ipAddress" text,
    "userAgent" text,
    "userId" text NOT NULL
);

CREATE TABLE "user" (
    id text NOT NULL,
    name text NOT NULL,
    email text NOT NULL,
    "emailVerified" boolean NOT NULL,
    image text,
    "createdAt" timestamp(3) without time zone NOT NULL,
    "updatedAt" timestamp(3) without time zone NOT NULL,
    username text,
    "displayUsername" text
);

CREATE TABLE verification (
    id text NOT NULL,
    identifier text NOT NULL,
    value text NOT NULL,
    "expiresAt" timestamp(3) without time zone NOT NULL,
    "createdAt" timestamp(3) without time zone,
    "updatedAt" timestamp(3) without time zone
);

ALTER TABLE ONLY "GameParticipant"
    ADD CONSTRAINT "GameParticipant_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY "GameRound"
    ADD CONSTRAINT "GameRound_pkey" PRIMARY KEY ("gameId", round);

ALTER TABLE ONLY "Game"
    ADD CONSTRAINT "Game_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY "TrackerPlayer"
    ADD CONSTRAINT "TrackerPlayer_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY "Tracker"
    ADD CONSTRAINT "Tracker_pkey" PRIMARY KEY (id);

ALTER TABLE ONLY account
    ADD CONSTRAINT account_pkey PRIMARY KEY (id);

ALTER TABLE ONLY session
    ADD CONSTRAINT session_pkey PRIMARY KEY (id);

ALTER TABLE ONLY "user"
    ADD CONSTRAINT user_pkey PRIMARY KEY (id);

ALTER TABLE ONLY verification
    ADD CONSTRAINT verification_pkey PRIMARY KEY (id);

CREATE UNIQUE INDEX "GameParticipant_gameId_userId_key" ON "GameParticipant" USING btree ("gameId", "userId");

CREATE UNIQUE INDEX "GameRound_gameId_round_key" ON "GameRound" USING btree ("gameId", round);

CREATE INDEX "Game_trackerId_idx" ON "Game" USING btree ("trackerId");

CREATE UNIQUE INDEX "TrackerPlayer_trackerId_displayName_key" ON "TrackerPlayer" USING btree ("trackerId", "displayName");

CREATE UNIQUE INDEX "TrackerPlayer_trackerId_playerId_key" ON "TrackerPlayer" USING btree ("trackerId", "playerId");

CREATE UNIQUE INDEX "Tracker_creatorId_displayName_key" ON "Tracker" USING btree ("creatorId", "displayName");

CREATE INDEX "Tracker_creatorId_type_idx" ON "Tracker" USING btree ("creatorId", type);

CREATE UNIQUE INDEX session_token_key ON session USING btree (token);

CREATE UNIQUE INDEX user_email_key ON "user" USING btree (email);

CREATE UNIQUE INDEX user_username_key ON "user" USING btree (username);

ALTER TABLE ONLY "GameParticipant"
    ADD CONSTRAINT "GameParticipant_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "GameParticipant"
    ADD CONSTRAINT "GameParticipant_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY "GameRound"
    ADD CONSTRAINT "GameRound_gameId_fkey" FOREIGN KEY ("gameId") REFERENCES "Game"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "Game"
    ADD CONSTRAINT "Game_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"(id) ON UPDATE CASCADE ON DELETE RESTRICT;

ALTER TABLE ONLY "TrackerPlayer"
    ADD CONSTRAINT "TrackerPlayer_playerId_fkey" FOREIGN KEY ("playerId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "TrackerPlayer"
    ADD CONSTRAINT "TrackerPlayer_trackerId_fkey" FOREIGN KEY ("trackerId") REFERENCES "Tracker"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY "Tracker"
    ADD CONSTRAINT "Tracker_creatorId_fkey" FOREIGN KEY ("creatorId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE SET NULL;

ALTER TABLE ONLY account
    ADD CONSTRAINT "account_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE;

ALTER TABLE ONLY session
    ADD CONSTRAINT "session_userId_fkey" FOREIGN KEY ("userId") REFERENCES "user"(id) ON UPDATE CASCADE ON DELETE CASCADE;


