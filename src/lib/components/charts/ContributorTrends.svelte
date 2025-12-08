<script lang="ts">
    import { onMount } from "svelte";
    import Chart from "chart.js/auto";

    interface Contributor {
        name: string;
        commitCount: number;
    }

    interface Props {
        contributors: Contributor[];
        title?: string;
    }

    let { contributors, title = "Top Contributors" }: Props = $props();

    let chartCanvas: HTMLCanvasElement;
    let chartInstance: Chart | null = null;

    // Get top 10 contributors
    let topContributors = $derived(
        [...contributors]
            .sort((a, b) => b.commitCount - a.commitCount)
            .slice(0, 10),
    );

    function createChart() {
        if (chartInstance) {
            chartInstance.destroy();
        }

        if (!chartCanvas || topContributors.length === 0) {
            return;
        }

        const ctx = chartCanvas.getContext("2d");
        if (!ctx) return;

        chartInstance = new Chart(ctx, {
            type: "bar",
            data: {
                labels: topContributors.map(
                    (c) => c.name || "Unknown",
                ),
                datasets: [
                    {
                        label: "Commits",
                        data: topContributors.map((c) => c.commitCount),
                        backgroundColor: "rgba(59, 130, 246, 0.8)",
                        borderColor: "rgba(59, 130, 246, 1)",
                        borderWidth: 1,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: true,
                aspectRatio: 2,
                plugins: {
                    legend: {
                        display: false,
                    },
                    title: {
                        display: true,
                        text: title,
                        font: {
                            size: 16,
                            weight: "bold",
                        },
                    },
                    tooltip: {
                        callbacks: {
                            label: function (context) {
                                return `${context.parsed.y} commit${context.parsed.y !== 1 ? "s" : ""}`;
                            },
                        },
                    },
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        ticks: {
                            precision: 0,
                        },
                    },
                    x: {
                        ticks: {
                            maxRotation: 45,
                            minRotation: 45,
                        },
                    },
                },
            },
        });
    }

    // Recreate chart when contributors change
    $effect(() => {
        if (topContributors) {
            createChart();
        }
    });

    onMount(() => {
        return () => {
            if (chartInstance) {
                chartInstance.destroy();
            }
        };
    });
</script>

<div class="w-full">
    {#if topContributors.length === 0}
        <div class="py-8 text-center text-sm text-muted-foreground">
            No contributor data available
        </div>
    {:else}
        <canvas bind:this={chartCanvas}></canvas>
    {/if}
</div>
