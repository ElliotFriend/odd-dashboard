<script lang="ts">
    import { onMount, onDestroy } from 'svelte';
    import {
        Chart,
        CategoryScale,
        LinearScale,
        BarElement,
        Title,
        Tooltip,
        Legend,
        type ChartConfiguration,
    } from 'chart.js';

    interface ContributionChartProps {
        data: Array<{
            date: string;
            commits: number;
        }>;
        class?: string;
    }

    let { data, class: className = '' }: ContributionChartProps = $props();

    let chartContainer: HTMLCanvasElement | null = $state(null);
    let chart: Chart | null = $state(null);

    // Register Chart.js components
    Chart.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

    function renderChart() {
        if (!chartContainer) return;

        // Destroy existing chart if it exists
        if (chart) {
            chart.destroy();
        }

        const config: ChartConfiguration<'bar'> = {
            type: 'bar',
            data: {
                labels: data.map((d) => {
                    const date = new Date(d.date);
                    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                }),
                datasets: [
                    {
                        label: 'Commits',
                        data: data.map((d) => d.commits),
                        backgroundColor: 'rgba(59, 130, 246, 0.5)',
                        borderColor: 'rgba(59, 130, 246, 1)',
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: 'Contribution Activity',
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
