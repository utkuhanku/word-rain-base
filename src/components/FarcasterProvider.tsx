"use client";

import { useEffect } from "react";
import sdk from "@farcaster/frame-sdk";

export default function FarcasterProvider({ children }: { children: React.ReactNode }) {
    useEffect(() => {
        const load = async () => {
            sdk.actions.ready();
        };
        load();
    }, []);

    return <>{children}</>;
}
