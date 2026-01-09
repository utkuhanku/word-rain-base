require("dotenv").config();

console.log("--- ENV DEBUG START ---");
console.log("Current Directory:", process.cwd());
const key = process.env.PRIVATE_KEY;
console.log("PRIVATE_KEY Type:", typeof key);
console.log("PRIVATE_KEY Length:", key ? key.length : 0);
console.log("PRIVATE_KEY Starts With:", key ? key.substring(0, 2) : "N/A");

if (!key) {
    console.log("ERROR: PRIVATE_KEY is empty/undefined.");
} else if (key.length < 60) {
    console.log("WARNING: PRIVATE_KEY looks too short for a private key.");
} else {
    console.log("SUCCESS: PRIVATE_KEY appears to be loaded.");
}
console.log("--- ENV DEBUG END ---");
