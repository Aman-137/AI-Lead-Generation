import dotenv from "dotenv";
import path from "path";

// Load env vars before anything else
dotenv.config({ path: path.resolve(__dirname, "../../.env") });
