import "dotenv/config";

export default {
	schema: "./db/schema.js",
	out: "./drizzle",
	dialect: "postgresql",
	dbCredentials: {
		host: process.env.DB_HOST,
		user: process.env.DB_USER,
		password: process.env.DB_PASSWORD,
		database: process.env.DB_NAME,
	},
} 
