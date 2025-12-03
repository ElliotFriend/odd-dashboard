<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import {
        Chart,
        CategoryScale,
        LinearScale,
        LineElement,
        PointElement,
        Title,
        Tooltip,
        Legend,
        type ChartConfiguration,
    } from 'chart.js';

    interface ActivityTimelineProps {
        data: Array<{
            date: string;
            commits: number;
            contributors: number;
        }>;
        class?: string;
    }

    let { data, class: className = '' }: ActivityTimelineProps = $props();

    let chartContainer: HTMLCanvasElement | null = $state(null);
    let chart: Chart | null = $state(null);

    // Register Chart.js components
    Chart.register(CategoryScale, LinearScale, LineElement, PointElement, Title, Tooltip, Legend);

    function renderChart() {
        if (!chartContainer) return;

        // Destroy existing chart if it exists
        if (chart) {
            chart.destroy();
        }

        const config: ChartConfiguration<'line'> = {
            type: 'line',
            data: {
                labels: data.map((d) => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [
                    {
                        label: 'Commits',
                        data: data.map((d) => d.commits),
                        borderColor: 'rgba(59, 130, 246, 1)',
                        backgroundColor: 'rgba(59, 130, 246, 0.1)',
                        tension: 0.4,
                        fill: true,
                    },
                    {
                        label: 'Contributors',
                        data: data.map((d) => d.contributors),
                        borderColor: 'rgba(16, 185, 129, 1)',
                        backgroundColor: 'rgba(16, 185, 129, 0.1)',
                        tension: 0.4,
                        fill: true,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: true,
                        position: 'top',
                    },
                    title: {
                        display: true,
                        text: 'Activity Timeline',
                    },
                    tooltip: {
                        mode: 'index',
                        intersect: false,
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            stepSize: 1,
                        },
                    },
                },
            },
        };

        chart = new Chart(chartContainer, config);
    }

    $effect(() => {
        if (data.length > 0 && chartContainer) {
            renderChart();
        }
    });

    onDestroy(() => {
        if (chart) {
            chart.destroy();
        }
    });
</script>

<div class="w-full {className}">
    <div class="h-64">
        <canvas bind:this={chartContainer}></canvas>
    </div>
</div>
