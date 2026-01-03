'use client';

import { SignInButton } from '@farcaster/auth-kit';

export default function FarcasterSignIn() {
    return (
        <SignInButton
            onSuccess={({ fid, username }) => console.log('Signed in', { fid, username })}
        />
    );
}
