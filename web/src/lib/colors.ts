// Deterministic color per event partner — used by the chart bands and the legend
// so they always agree. Kept distinct from the line palette (amber/cyan/rose) so
// event bands read as a separate layer behind the series.
const KNOWN: Record<string, string> = {
    Drips: '#6f8fff',
    GrantFox: '#b58cff',
    "Stellar Hacks": "#c85c14",
};
const FALLBACK = ['#7ec97e', '#e8a85a', '#e0738d', '#5fd4d0', '#b58cff', '#6f8fff'];

export function partnerColor(partner: string): string {
    if (KNOWN[partner]) return KNOWN[partner];
    let h = 0;
    for (let i = 0; i < partner.length; i++) h = (h * 31 + partner.charCodeAt(i)) >>> 0;
    return FALLBACK[h % FALLBACK.length];
}
