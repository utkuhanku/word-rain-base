async function main() {
    const addr = "0x6edd22E9792132614dD487aC6434dec3709b79A8";
    console.log(`Checking Searchcaster for ${addr}...`);

    try {
        const res = await fetch(`https://searchcaster.xyz/api/profiles?address=${addr}`);
        const data = await res.json();

        console.log("Status:", res.status);
        console.log("Found:", data.length);
        if (data.length > 0) {
            console.log("User:", data[0].username, data[0].displayName);
        }
    } catch (e) {
        console.error("Error:", e.message);
    }
}
main();
