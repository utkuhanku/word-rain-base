import { motion, AnimatePresence } from 'framer-motion';

interface PlayerDetailModalProps {
    isOpen: boolean;
    onClose: () => void;
    player: any;
}

export default function PlayerDetailModal({ isOpen, onClose, player }: PlayerDetailModalProps) {
    if (!player) return null;

    // Resolve Address: Remove 'wallet:' prefix if present
    const rawAddress = player.member?.startsWith('wallet:')
        ? player.member.replace('wallet:', '')
        : player.member;

    // Ensure it looks like an ETH address
    const isValidAddress = rawAddress?.startsWith('0x') && rawAddress.length === 42;
    const address = isValidAddress ? (rawAddress as `0x${string}`) : undefined;

    // Stats
    const activeDays = player.streak || 0;
    const revives = player.revivesUsed || 0;
    const lastActive = player.lastActive ? new Date(player.lastActive).toLocaleDateString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' }) : 'Now';

    return (
        <AnimatePresence>
            {isOpen && (
                <>
                    {/* Backdrop */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        onClick={onClose}
                        className="fixed inset-0 bg-black/60 backdrop-blur-md z-50"
                    />

                    {/* Modal */}
                    <motion.div
                        initial={{ scale: 0.95, opacity: 0, y: 30 }}
                        animate={{ scale: 1, opacity: 1, y: 0 }}
                        exit={{ scale: 0.95, opacity: 0, y: 30 }}
                        className="fixed z-50 w-full max-w-sm left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
                    >
                        <div className="relative bg-[#0A0A0A] border border-white/10 rounded-3xl overflow-hidden shadow-2xl">

                            {/* Decorative Background Mesh */}
                            <div className="absolute inset-0 z-0">
                                <div className="absolute top-0 left-0 w-full h-32 bg-gradient-to-b from-[#0052FF]/20 to-transparent" />
                                <div className="absolute top-[-50%] left-[-50%] w-[200%] h-[200%] opacity-[0.03] bg-[url('https://grainy-gradients.vercel.app/noise.svg')]" />
                            </div>

                            {/* Content */}
                            <div className="relative z-10 p-6 pt-8 flex flex-col items-center">

                                {/* Close Button */}
                                <button
                                    onClick={onClose}
                                    className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full bg-white/5 hover:bg-white/10 text-zinc-400 transition-colors"
                                >
                                    ✕
                                </button>

                                {/* Avatar & Identity */}
                                <div className="relative mb-4">
                                    <div className="w-24 h-24 rounded-full p-1 bg-gradient-to-br from-[#0052FF] to-purple-500">
                                        <div className="w-full h-full rounded-full bg-black overflow-hidden relative flex items-center justify-center">
                                            {player.pfp_url ? (
                                                <img src={player.pfp_url} alt="Profile" className="w-full h-full object-cover" onError={(e) => { e.currentTarget.src = '/base-logo.svg'; }} />
                                            ) : (
                                                <img src="/base-logo.svg" alt="Profile" className="w-full h-full object-cover bg-white/5 p-4" />
                                            )}
                                        </div>
                                    </div>
                                    {/* Online Indicator */}
                                    <div className="absolute bottom-1 right-1 w-5 h-5 bg-black rounded-full flex items-center justify-center">
                                        <div className="w-3 h-3 bg-green-500 rounded-full border-2 border-black" />
                                    </div>
                                </div>

                                {/* Name & Address */}
                                <div className="text-center mb-8">
                                    {player.identifier ? (
                                        <div className="flex flex-col items-center">
                                            <h2 className="text-xl font-bold text-white tracking-tight">{player.displayName || player.username || "PLAYER ONE"}</h2>
                                            <span className="text-xs text-zinc-500 font-mono mt-1">
                                                {player.type === 'wallet' && player.identifier.length > 10
                                                    ? `${player.identifier.slice(0, 6)}...${player.identifier.slice(-4)}`
                                                    : player.identifier}
                                            </span>
                                        </div>
                                    ) : (
                                        <h2 className="text-xl font-bold text-white">Unknown Agent</h2>
                                    )}
                                    <div className="mt-3 inline-flex items-center gap-1.5 px-3 py-1 bg-[#0052FF]/10 border border-[#0052FF]/20 rounded-full">
                                        <span className="w-1.5 h-1.5 rounded-full bg-[#0052FF] animate-pulse" />
                                        <span className="text-[10px] font-bold text-[#0052FF] uppercase tracking-wide">Verified Agent</span>
                                    </div>
                                </div>

                                {/* Stats Grid */}
                                <div className="grid grid-cols-2 gap-3 w-full mb-6">
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-1 group hover:border-white/10 transition-colors">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">High Score</span>
                                        <span className="text-2xl font-black text-white">{player.score.toLocaleString()}</span>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-1 group hover:border-white/10 transition-colors">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Streak</span>
                                        <span className="text-2xl font-black text-orange-500 drop-shadow-[0_0_10px_rgba(249,115,22,0.3)]">🔥 {activeDays}</span>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-1 group hover:border-white/10 transition-colors">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Global Rank</span>
                                        <span className="text-xl font-bold text-white">#{player.rank}</span>
                                    </div>
                                    <div className="p-4 rounded-2xl bg-white/5 border border-white/5 flex flex-col items-center gap-1 group hover:border-white/10 transition-colors">
                                        <span className="text-[10px] text-zinc-500 uppercase tracking-widest font-mono">Lives Used</span>
                                        <span className="text-xl font-bold text-white">❤️ {revives}</span>
                                    </div>
                                </div>

                                {/* Footer */}
                                <div className="w-full pt-4 border-t border-white/5 flex justify-between items-center text-[10px] uppercase tracking-widest text-zinc-600 font-mono">
                                    <span>Last Active</span>
                                    <span className="text-zinc-400">{lastActive}</span>
                                </div>

                            </div>
                        </div>
                    </motion.div>
                </>
            )}
        </AnimatePresence>
    );
}
