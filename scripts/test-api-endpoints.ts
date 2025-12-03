/**
 * API Endpoint Testing Script
 *
 * Tests CRUD operations and validation for all API endpoints
 */

const BASE_URL = "http://localhost:5173";

interface TestResult {
    name: string;
    passed: boolean;
    message?: string;
    error?: any;
}

const results: TestResult[] = [];

async function testRequest(url: string, options?: RequestInit): Promise<any> {
    try {
        const response = await fetch(`${BASE_URL}${url}`, options);

        let data;
        try {
            const text = await response.text();
            data = text ? JSON.parse(text) : null;
        } catch (e) {
            data = null;
        }

        // Unwrap {data: ...} responses
        if (data && typeof data === "object" && "data" in data) {
            data = data.data;
        }

        return {
            status: response.status,
            ok: response.ok,
            data,
        };
    } catch (error) {
        console.error(`Request failed: ${url}`, error);
        return {
            status: 0,
            ok: false,
            error: error instanceof Error ? error.message : String(error),
        };
    }
}

// ============================================================================
// AGENCY TESTS
// ============================================================================

async function testAgencyCreate() {
    console.log("\n🧪 Testing Agency Create...");

    const response = await testRequest("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Test Agency " + Date.now(),
            description: "A test agency for automated testing",
        }),
    });

    results.push({
        name: "Agency: Create with valid data",
        passed: response.status === 201 && response.data.id !== undefined,
        message:
            response.status !== 201
                ? `Expected 201, got ${response.status}`
                : undefined,
    });

    return response.data;
}

async function testAgencyList() {
    console.log("\n🧪 Testing Agency List...");

    const response = await testRequest("/api/agencies");

    results.push({
        name: "Agency: List all agencies",
        passed: response.status === 200 && Array.isArray(response.data),
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });

    return response.data;
}

async function testAgencyGet(id: number) {
    console.log("\n🧪 Testing Agency Get...");

    const response = await testRequest(`/api/agencies/${id}`);

    results.push({
        name: "Agency: Get single agency",
        passed: response.status === 200 && response.data.id === id,
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });

    return response.data;
}

async function testAgencyUpdate(id: number) {
    console.log("\n🧪 Testing Agency Update...");

    const response = await testRequest(`/api/agencies/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            description: "Updated description for testing",
        }),
    });

    results.push({
        name: "Agency: Update agency",
        passed:
            response.status === 200 &&
            response.data.description === "Updated description for testing",
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });
}

async function testAgencyValidation() {
    console.log("\n🧪 Testing Agency Validation...");

    // Test missing name
    const response1 = await testRequest("/api/agencies", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            description: "No name provided",
        }),
    });

    results.push({
        name: "Agency: Validation - reject missing name",
        passed: response1.status === 422 || response1.status === 400,
        message:
            response1.status !== 422 && response1.status !== 400
                ? `Expected 422 or 400, got ${response1.status}`
                : undefined,
    });
}

async function testAgencyDelete(id: number) {
    console.log("\n🧪 Testing Agency Delete...");

    const response = await testRequest(`/api/agencies/${id}`, {
        method: "DELETE",
    });

    results.push({
        name: "Agency: Delete agency",
        passed: response.status === 204 || response.status === 200,
        message:
            response.status !== 204 && response.status !== 200
                ? `Expected 204 or 200, got ${response.status}`
                : undefined,
    });
}

// ============================================================================
// ECOSYSTEM TESTS
// ============================================================================

async function testEcosystemCreate() {
    console.log("\n🧪 Testing Ecosystem Create...");

    const response = await testRequest("/api/ecosystems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Test Ecosystem " + Date.now(),
        }),
    });

    results.push({
        name: "Ecosystem: Create with valid data",
        passed: response.status === 201 && response.data.id !== undefined,
        message:
            response.status !== 201
                ? `Expected 201, got ${response.status}`
                : undefined,
    });

    return response.data;
}

async function testEcosystemList() {
    console.log("\n🧪 Testing Ecosystem List...");

    const response = await testRequest("/api/ecosystems");

    results.push({
        name: "Ecosystem: List all ecosystems",
        passed: response.status === 200 && Array.isArray(response.data),
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });

    return response.data;
}

async function testEcosystemValidation() {
    console.log("\n🧪 Testing Ecosystem Validation...");

    // Test missing name
    const response1 = await testRequest("/api/ecosystems", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
    });

    results.push({
        name: "Ecosystem: Validation - reject missing name",
        passed: response1.status === 422 || response1.status === 400,
        message:
            response1.status !== 422 && response1.status !== 400
                ? `Expected 422 or 400, got ${response1.status}`
                : undefined,
    });
}

// ============================================================================
// EVENT TESTS
// ============================================================================

async function testEventCreate(agencyId?: number) {
    console.log("\n🧪 Testing Event Create...");

    const eventData: any = {
        name: "Test Event " + Date.now(),
        description: "A test event for automated testing",
        startDate: "2024-01-01",
        endDate: "2024-01-31",
    };

    if (agencyId) {
        eventData.agencyId = agencyId;
    }

    const response = await testRequest("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(eventData),
    });

    results.push({
        name: "Event: Create with valid data",
        passed: response.status === 201 && response.data.id !== undefined,
        message:
            response.status !== 201
                ? `Expected 201, got ${response.status}`
                : undefined,
    });

    return response.data;
}

async function testEventList() {
    console.log("\n🧪 Testing Event List...");

    const response = await testRequest("/api/events");

    results.push({
        name: "Event: List all events",
        passed: response.status === 200 && Array.isArray(response.data),
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });

    return response.data;
}

async function testEventGet(id: number) {
    console.log("\n🧪 Testing Event Get...");

    const response = await testRequest(`/api/events/${id}`);

    results.push({
        name: "Event: Get single event",
        passed: response.status === 200 && response.data.id === id,
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });

    return response.data;
}

async function testEventUpdate(id: number) {
    console.log("\n🧪 Testing Event Update...");

    const response = await testRequest(`/api/events/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            description: "Updated event description",
        }),
    });

    results.push({
        name: "Event: Update event",
        passed:
            response.status === 200 &&
            response.data.description === "Updated event description",
        message:
            response.status !== 200 ? `Expected 200, got ${response.status}` : undefined,
    });
}

async function testEventDateValidation() {
    console.log("\n🧪 Testing Event Date Validation...");

    // Test end date before start date
    const response = await testRequest("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            name: "Invalid Date Event " + Date.now(),
            startDate: "2024-12-31",
            endDate: "2024-01-01", // End before start
        }),
    });

    results.push({
        name: "Event: Validation - reject end date before start date",
        passed: response.status === 422 || response.status === 400,
        message:
            response.status !== 422 && response.status !== 400
                ? `Expected 422 or 400, got ${response.status}`
                : undefined,
    });
}

async function testEventDelete(id: number) {
    console.log("\n🧪 Testing Event Delete...");

    const response = await testRequest(`/api/events/${id}`, {
        method: "DELETE",
    });

    results.push({
        name: "Event: Delete event",
        passed: response.status === 204 || response.status === 200,
        message:
            response.status !== 204 && response.status !== 200
                ? `Expected 204 or 200, got ${response.status}`
                : undefined,
    });
}

// ============================================================================
// MAIN TEST RUNNER
// ============================================================================

async function runTests() {
    console.log("=".repeat(80));
    console.log("API ENDPOINT TESTING");
    console.log("=".repeat(80));

    let agencyId: number | undefined;
    let ecosystemId: number | undefined;
    let eventId: number | undefined;

    try {
        // Agency Tests
        console.log("\n" + "=".repeat(80));
        console.log("AGENCY TESTS");
        console.log("=".repeat(80));

        const agency = await testAgencyCreate();
        agencyId = agency?.id;

        await testAgencyList();

        if (agencyId) {
            await testAgencyGet(agencyId);
            await testAgencyUpdate(agencyId);
        }

        await testAgencyValidation();

        // Ecosystem Tests
        console.log("\n" + "=".repeat(80));
        console.log("ECOSYSTEM TESTS");
        console.log("=".repeat(80));

        const ecosystem = await testEcosystemCreate();
        ecosystemId = ecosystem?.id;

        await testEcosystemList();
        await testEcosystemValidation();

        // Event Tests
        console.log("\n" + "=".repeat(80));
        console.log("EVENT TESTS");
        console.log("=".repeat(80));

        const event = await testEventCreate(agencyId);
        eventId = event?.id;

        await testEventList();

        if (eventId) {
            await testEventGet(eventId);
            await testEventUpdate(eventId);
        }

        await testEventDateValidation();

        // Cleanup
        console.log("\n" + "=".repeat(80));
        console.log("CLEANUP");
        console.log("=".repeat(80));

        if (eventId) {
            await testEventDelete(eventId);
        }

        if (agencyId) {
            await testAgencyDelete(agencyId);
        }
    } catch (error) {
        console.error("Test execution error:", error);
    }

    // Print results
    console.log("\n" + "=".repeat(80));
    console.log("TEST RESULTS");
    console.log("=".repeat(80) + "\n");

    const passed = results.filter((r) => r.passed);
    const failed = results.filter((r) => !r.passed);

    console.log(`✅ Passed: ${passed.length}`);
    console.log(`❌ Failed: ${failed.length}`);
    console.log(`📊 Total:  ${results.length}\n`);

    if (failed.length > 0) {
        console.log("Failed Tests:");
        console.log("-".repeat(80));
        for (const result of failed) {
            console.log(`❌ ${result.name}`);
            if (result.message) {
                console.log(`   ${result.message}`);
            }
            if (result.error) {
                console.log(`   Error: ${result.error}`);
            }
        }
        console.log();
    }

    console.log("=".repeat(80) + "\n");

    return failed.length === 0;
}

// Run tests
runTests()
    .then((success) => {
        process.exit(success ? 0 : 1);
    })
    .catch((error) => {
        console.error("Fatal error:", error);
        process.exit(1);
    });
