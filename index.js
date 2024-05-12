import express from 'express'
import * as dotenv from "dotenv";
import * as jose from 'jose';
import z from "zod";
import { drizzle } from "drizzle-orm/node-postgres";
import PG from "pg";
import * as schema from "./db/schema.js";
import { eq } from 'drizzle-orm';

dotenv.config({
    path: ".env",
});

const client = new PG.Client({
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    host: process.env.DB_HOST,
    port: 5432,
    database: process.env.DB_NAME,
});

await client.connect();
const db = drizzle(client);

console.log('getting JWKS...');
const JWKS = jose.createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'))
console.log('JWKS done');

const app = express()
const port = 5172

app.use(express.json());
app.use(function (req, res, next) {
    res.setHeader("Access-Control-Allow-Origin", req.get("origin") || "*");
    res.setHeader("Access-Control-Allow-Credentials", "true");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");
    next();
});


export const decodeAuth0Token = async (token) => await jose.jwtVerify(token, JWKS, {
    issuer: process.env.ISSUER_BASE_URL,
    audience: process.env.AUDIENCE,
})


const checkAdminAccess = function (req, res, next) {
    if (req.headers.authorization.split(' ')[1] !== process.env.ADMIN_TOKEN) {
        res.status(403).send('Access denied')
        return
    }
    next()
}

// Get vote
app.get('/vote/:vote_id', async (req, res) => {
    const voteId = req.params.vote_id

    const vote = await db.query.votings.findFirst({
        where: { id: voteId },
    });
    if (!vote) {
        res.status(404).send('Vote not found')
        return
    }

    res.json({
        vote_id: voteId,
        active: true,
        allowed_participants: [],
        name: 'Vote name',
        options: [{
            label: 'Option 1',
            value: 1
        },
        {
            label: 'Option 2',
            value: 2
        }, {
            label: 'Option 3',
            value: 3
        }]
    })
})

// Create a new vote
app.post('/vote/:vote_id', checkAdminAccess, async (req, res) => {
    const voteId = req.params.vote_id

    const vote = (await db.select().from(schema.votings).where(eq(schema.votings.id, voteId)))[0];
    if (vote) {
        res.status(404).send('Vote with this id already exists')
        return
    }

    const inputSchema = z.object({
        active: z.boolean(),
        allowed_participants: z.array(z.string()).optional(),
        allow_all: z.boolean().optional(),
    });

    try {
        const vote = inputSchema.parse(req.body);
        console.log(vote);

        await db.insert(schema.votings).values({ id: voteId, ...vote });

        return res.json({
            id: voteId,
            active: vote.active,
            allowed_participants: vote.allowed_participants,
            allow_all: vote.allow_all
        })
    } catch (error) {
        res.status(400).send(error.errors ?? error);
    }
})

// Update a vote
app.patch('/vote/:vote_id', checkAdminAccess, async (req, res) => {
    const voteId = req.params.vote_id

    const vote = (await db.select().from(schema.votings).where(eq(schema.votings.id, voteId)))[0];
    if (!vote) {
        res.status(404).send('Vote not found')
        return
    }

    const inputSchema = z.object({
        active: z.boolean().optional(),
        allowed_participants: z.array(z.string()).optional(),
        allow_all: z.boolean().optional(),
    });

    try {
        const vote = inputSchema.parse(req.body);
        console.log(vote);

        await db.update(schema.votings)
            .set(vote)
            .where(eq(schema.votings.id, voteId))
            .returning({ updatedId: schema.votings.id });

        res.json({
            vote_id: voteId,
            active: vote.active,
            allowed_participants: vote.allowed_participants,
            allow_all: vote.allow_all
        })
    } catch (error) {
        res.status(400).send(error.errors);
    }
})

// Get all keys
app.get('/vote/:vote_id/ring', async (req, res) => {
    const voteId = req.params.vote_id

    let vote = (await db.select().from(schema.votings).where(eq(schema.votings.id, voteId)))[0];
    if (!vote) {
        res.status(404).send('Vote not found')
        return
    }
    vote = {
        ...vote,
        keys: await db.select().from(schema.keys).where(eq(schema.keys.vote_id, voteId))
    }

    res.json({
        keys: vote.keys.map(key => key.publicKey)
    })
})

// Get key info
app.get('/vote/:vote_id/ring/:public_key', async (req, res) => {
    const voteId = req.params.vote_id
    const publicKey = req.params.public_key

    let vote = (await db.select().from(schema.votings).where(eq(schema.votings.id, voteId)))[0];
    if (!vote) {
        res.status(404).send('Vote not found')
        return
    }
    vote = {
        ...vote,
        keys: await db.select().from(schema.keys).where(eq(schema.keys.vote_id, voteId), eq(schema.keys.publicKey, publicKey))
    }

    if (vote.keys.length === 0) {
        res.status(404).send('Key not found')
        return
    }

    res.json({
        public_key: publicKey,
        email: vote.keys[0].email,
        full_name: vote.keys[0].name
    })
})

// Auth Google user
app.post('/vote/:vote_id/ring/:public_key', async (req, res) => {
    const voteId = req.params.vote_id
    const publicKey = req.params.public_key

    let vote = (await db.select().from(schema.votings).where(eq(schema.votings.id, voteId)))[0];
    if (!vote) {
        res.status(404).send('Vote not found')
        return
    }
    if (vote.active === false) {
        res.status(403).send('Vote is not active')
        return
    }
    vote = {
        ...vote,
        keys: await db.select().from(schema.keys).where(eq(schema.keys.vote_id, voteId))
    }

    const inputSchema = z.object({
        credential: z.string(),
    });

    if (!inputSchema.safeParse(req.body)) {
        res.status(400).send(inputSchema.safeParse(req.body).error)
        return
    }
    const input = inputSchema.parse(req.body);

    let user
    try {
        user = (await decodeAuth0Token(input.credential)).payload
        if (!user) {
            throw new Error('Invalid token')
        }
    } catch (error) {
        res.status(401).send('Unauthorized')
        return
    }

    if (!vote.allow_all && !vote.allowed_participants.some(email => email.toLowerCase() === user.email.toLowerCase())) {
        res.status(403).send('Access denied')
        return
    }

    if (vote.keys.some(key => key.email.toLowerCase() === user.email.toLowerCase())) {
        res.status(400).send('Key already exists')
        return
    }

    await db.insert(schema.keys).values({
        publicKey,
        vote_id: voteId,
        email: user.email,
        name: user.name
    });

    res.json({
        public_key: publicKey,
        email: user.email,
        full_name: user.name
    })
})

app.listen(port, () => {
    console.log(`🚀 Server listening on port ${port}`)
})