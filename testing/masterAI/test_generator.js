const fs = require('fs');
const path = require('path');

// Timeout Safety
const timeout = setTimeout(() => {
    console.error('TIMEOUT: Script took more than 5 seconds.');
    process.exit(1);
}, 5000);

// This script generates Jest test files based on the defined Decision Matrix in decision_matrix.md
const OUTPUT_DIR = path.join(__dirname, 'generated_tests');
const DECISION_MATRIX_FILE = path.join(__dirname, 'decision_matrix.md');

console.log('Starting MasterAI Test Generation...');

// 1. Ensure Output Directory
console.log('1. Checking output directory...');
if (!fs.existsSync(OUTPUT_DIR)) {
    console.log('   Creating directory: ' + OUTPUT_DIR);
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
} else {
    console.log('   Directory exists.');
}

// 2. Parse Markdown Table
function parseDecisionMatrix() {
    console.log('2. Reading Decision Matrix file...');
    if (!fs.existsSync(DECISION_MATRIX_FILE)) {
        console.error('ERROR: Decision Matrix file not found: ' + DECISION_MATRIX_FILE);
        process.exit(1);
    }

    const content = fs.readFileSync(DECISION_MATRIX_FILE, 'utf8');
    console.log('   File read: ' + content.length + ' bytes.');

    // Split lines robustly
    const lines = content.split(/\r?\n/);
    console.log('   Lines found: ' + lines.length);

    const cases = [];
    let capture = false;
    let index = 0;

    for (const line of lines) {
        index++;
        // Very basic checks to avoid infinite loops or weirdness
        if (index > 1000) {
            console.warn('WARNING: Stopping scan at 1000 lines to prevent runaway loop.');
            break;
        }

        if (line.includes('| Event Type |')) {
            capture = true;
            continue;
        }
        if (line.includes('| :---')) continue;
        if (!capture) continue;
        if (!line.trim().startsWith('|')) {
            capture = false;
            continue;
        }

        const parts = line.split('|').map(s => s.trim()).filter(s => s);
        // Skip separator rows (all parts are only dashes/colons like ':---')
        if (parts.every(p => /^[:\-\s]+$/.test(p))) continue;
        if (parts.length >= 4) {
            cases.push({
                event: parts[0],
                context: parts[1],
                workflow: parts[2],
                tools: parts[3]
            });
        }
    }
    console.log('   Test cases parsed: ' + cases.length);
    return cases;
}

// 3. Build a single test block string
function buildTestBlock(tc, index) {
    const workflowName = tc.workflow.replace(/`/g, '').trim();
    const eventName = tc.event.split(' ')[0].replace(/`/g, '').trim();
    const toolsList = tc.tools.split(',').map(t => t.trim().replace(/`/g, '').trim());

    const stepsArray = toolsList.map(t => "            { name: 'Step', tool: '" + t + "', args: {} }").join(',\n');
    const expectedArray = toolsList.map(t => "'" + t + "'").join(', ');

    let out = '';
    out += "    test('Row " + (index + 1) + ': ' + tc.event.replace(/'/g, "\\'") + ' -> ' + tc.workflow.replace(/'/g, "\\'") + "', async () => {\n";
    out += "        // Context: " + tc.context + "\n";
    out += "        harness.logicEngine.defineWorkflow('" + workflowName + "', '" + eventName + "', [\n";
    out += stepsArray + "\n";
    out += "        ], {});\n\n";
    out += "        const workflowId = await harness.logicEngine.executeWorkflow('" + workflowName + "', {});\n";
    out += "        expect(workflowId).toBeDefined();\n\n";
    out += "        // Wait for async execution (simple delay for Phase 1)\n";
    out += "        await new Promise(r => setTimeout(r, 50));\n\n";
    out += "        const details = harness.logicEngine.getWorkflowDetails(workflowId);\n";
    out += "        expect(details).not.toBeNull();\n";
    out += "        expect(details.status).not.toBe('FAILED');\n";
    out += "        expect(details.history.length).toBeGreaterThan(0);\n\n";
    out += "        const expectedTools = [" + expectedArray + "];\n";
    out += "        // Verify tool calls via harness.getCallHistory()\n";
    out += "    });\n";
    return out;
}

// 4. Main Execution Block
try {
    const testCases = parseDecisionMatrix();

    console.log('3. Generating Log...');
    let fileContent = '';
    fileContent += "/**\n";
    fileContent += " * AUTO-GENERATED TEST FILE\n";
    fileContent += " * Source: testing/masterAI/decision_matrix.md\n";
    fileContent += " * Generated at: " + new Date().toISOString() + "\n";
    fileContent += " *\n";
    fileContent += " * DO NOT EDIT MANUALLY\n";
    fileContent += " */\n";
    fileContent += "const { TestHarness } = require('../TestHarness');\n\n";
    fileContent += "describe('MasterAI Decision Matrix Compliance', () => {\n";
    fileContent += "    let harness;\n\n";
    fileContent += "    beforeEach(() => {\n";
    fileContent += "        harness = new TestHarness();\n";
    fileContent += "    });\n\n";

    for (let i = 0; i < testCases.length; i++) {
        fileContent += buildTestBlock(testCases[i], i) + '\n';
    }

    fileContent += "});\n";

    // 5. Write File
    console.log('4. Writing output file...');
    const outputPath = path.join(OUTPUT_DIR, 'decision_matrix.test.js');
    fs.writeFileSync(outputPath, fileContent);

    console.log('SUCCESS: Generated test file at: ' + outputPath);
    clearTimeout(timeout);
    process.exit(0);
} catch (err) {
    console.error('FATAL ERROR:', err);
    process.exit(1);
}
