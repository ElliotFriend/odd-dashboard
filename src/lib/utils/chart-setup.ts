import { browser } from '$app/environment';
import {
    Chart,
    CategoryScale,
    LinearScale,
    BarElement,
    LineElement,
    PointElement,
    Title,
    Tooltip,
    Legend,
    Filler,
} from 'chart.js';

// Register Chart.js components once (browser-only)
let registered = false;

export function setupChartJS() {
    if (browser && !registered) {
        Chart.register(
            CategoryScale,
            LinearScale,
            BarElement,
            LineElement,
            PointElement,
            Filler,
            Title,
            Tooltip,
            Legend
        );
        registered = true;
    }
}

// Auto-setup on import (only in browser)
setupChartJS();
