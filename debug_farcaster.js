async function main() {
    const addresses = ["0x6edd22E9792132614dD487aC6434dec3709b79A8"];

    for (const addr of addresses) {
        console.log(`Checking ${addr}...`);
        try {
            const res = await fetch(`https://api.warpcast.com/v2/user-by-verification?address=${addr}`);
            const data = await res.json();

            console.log("Response Status:", res.status);
            console.log("Data:", JSON.stringify(data, null, 2));

            if (data?.result?.user?.username) {
                console.log(`✅ Username found: @${data.result.user.username}`);
            } else {
                console.log("❌ No username found in response.");
            }
        } catch (e) {
            console.error("Fetch Error:", e.message);
        }
    }
}

main();
