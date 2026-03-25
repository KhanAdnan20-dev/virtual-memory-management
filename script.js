/**
 * Virtual Memory Management Simulation
 * Supports: FIFO, LRU, and Optimal page replacement algorithms
 */

/* ─────────────────────────────────────────
   Page Replacement Algorithms
───────────────────────────────────────── */

/**
 * Run FIFO page replacement.
 * @param {number[]} pages  - Reference string
 * @param {number}   frames - Number of physical frames
 * @returns {SimulationResult}
 */
function fifo(pages, frames) {
  const memory = [];   // current pages in memory (queue order)
  const steps = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const before = [...memory];

    if (memory.includes(page)) {
      // Page hit – nothing changes
      steps.push({ page, memory: [...memory], fault: false, evicted: null, added: null });
    } else {
      // Page fault
      let evicted = null;
      if (memory.length < frames) {
        memory.push(page);
      } else {
        evicted = memory.shift();   // remove oldest (front of queue)
        memory.push(page);
      }
      steps.push({ page, memory: [...memory], fault: true, evicted, added: page, before });
    }
  }

  return buildResult(steps, frames);
}

/**
 * Run LRU page replacement.
 * @param {number[]} pages  - Reference string
 * @param {number}   frames - Number of physical frames
 * @returns {SimulationResult}
 */
function lru(pages, frames) {
  const memory = [];   // current pages in memory
  const order = [];    // tracks recency (most recent at end)
  const steps = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (memory.includes(page)) {
      // Page hit – update recency
      const idx = order.indexOf(page);
      order.splice(idx, 1);
      order.push(page);
      steps.push({ page, memory: [...memory], fault: false, evicted: null, added: null });
    } else {
      // Page fault
      let evicted = null;
      if (memory.length < frames) {
        memory.push(page);
      } else {
        evicted = order.shift();           // least recently used
        const idx = memory.indexOf(evicted);
        memory.splice(idx, 1, page);
      }
      order.push(page);
      steps.push({ page, memory: [...memory], fault: true, evicted, added: page });
    }
  }

  return buildResult(steps, frames);
}

/**
 * Run Optimal page replacement (Bélády's algorithm).
 * @param {number[]} pages  - Reference string
 * @param {number}   frames - Number of physical frames
 * @returns {SimulationResult}
 */
function optimal(pages, frames) {
  const memory = [];
  const steps = [];

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];

    if (memory.includes(page)) {
      steps.push({ page, memory: [...memory], fault: false, evicted: null, added: null });
    } else {
      let evicted = null;
      if (memory.length < frames) {
        memory.push(page);
      } else {
        // Find the page in memory whose next use is farthest in the future
        let farthest = -1;
        let victimIdx = -1;
        for (let j = 0; j < memory.length; j++) {
          const nextUse = pages.indexOf(memory[j], i + 1);
          const dist = nextUse === -1 ? Infinity : nextUse;
          if (dist > farthest) {
            farthest = dist;
            victimIdx = j;
          }
        }
        evicted = memory[victimIdx];
        memory.splice(victimIdx, 1, page);
      }
      steps.push({ page, memory: [...memory], fault: true, evicted, added: page });
    }
  }

  return buildResult(steps, frames);
}

/**
 * Convert raw steps into a structured SimulationResult.
 * @param {object[]} steps
 * @param {number}   frames
 * @returns {SimulationResult}
 */
function buildResult(steps, frames) {
  const faults = steps.filter(s => s.fault).length;
  return {
    steps,
    frames,
    total: steps.length,
    faults,
    hits: steps.length - faults,
    faultRate: ((faults / steps.length) * 100).toFixed(1),
  };
}

/* ─────────────────────────────────────────
   DOM Helpers
───────────────────────────────────────── */

function el(id) {
  return document.getElementById(id);
}

function setTextContent(id, value) {
  el(id).textContent = value;
}

/* ─────────────────────────────────────────
   Table Renderer
───────────────────────────────────────── */

/**
 * Render the simulation table from a SimulationResult.
 * Rows: "Reference", one row per frame slot, "Status"
 * Columns: one per step
 *
 * @param {SimulationResult} result
 * @param {string}           algoName  - Display name of algorithm
 */
function renderTable(result, algoName) {
  const { steps, frames } = result;

  el('tableTitle').textContent = `${algoName} — Step-by-Step`;

  // ── Header row (step numbers) ──────────────────────
  const thead = el('simHead');
  thead.innerHTML = '';
  const headerRow = document.createElement('tr');

  const cornerTh = document.createElement('th');
  cornerTh.textContent = 'Step';
  headerRow.appendChild(cornerTh);

  steps.forEach((s, i) => {
    const th = document.createElement('th');
    th.textContent = i + 1;
    headerRow.appendChild(th);
  });
  thead.appendChild(headerRow);

  // ── Body ──────────────────────────────────────────
  const tbody = el('simBody');
  tbody.innerHTML = '';

  // Row 1: Reference string
  const refRow = document.createElement('tr');
  const refLabelTd = document.createElement('td');
  refLabelTd.textContent = 'Reference';
  refRow.appendChild(refLabelTd);

  steps.forEach(s => {
    const td = document.createElement('td');
    const span = document.createElement('span');
    span.className = 'ref-page';
    span.textContent = s.page;
    td.appendChild(span);
    refRow.appendChild(td);
  });
  tbody.appendChild(refRow);

  // Rows 2…N+1: Frame slots
  // We need to know which page occupies each "slot" at each step.
  // Track slot contents across steps so we can colour new/evicted/stay.
  const slotHistory = buildSlotHistory(steps, frames);

  for (let frameIdx = 0; frameIdx < frames; frameIdx++) {
    const row = document.createElement('tr');

    const labelTd = document.createElement('td');
    labelTd.textContent = `Frame ${frameIdx + 1}`;
    row.appendChild(labelTd);

    steps.forEach((s, stepIdx) => {
      const td = document.createElement('td');
      const val = slotHistory[stepIdx][frameIdx];

      if (val !== null && val !== undefined) {
        const span = document.createElement('span');
        span.textContent = val;

        const prevVal = stepIdx > 0 ? slotHistory[stepIdx - 1][frameIdx] : null;
        const isNewlyLoaded = s.fault && val === s.added && val !== prevVal;
        span.className = isNewlyLoaded ? 'cell cell--new' : 'cell cell--stay';

        td.appendChild(span);
      }

      row.appendChild(td);
    });
    tbody.appendChild(row);
  }

  // Last row: Fault/Hit status
  const statusRow = document.createElement('tr');
  const statusLabelTd = document.createElement('td');
  statusLabelTd.textContent = 'Status';
  statusRow.appendChild(statusLabelTd);

  steps.forEach(s => {
    const td = document.createElement('td');
    td.className = s.fault ? 'status-fault' : 'status-hit';
    td.textContent = s.fault ? 'F' : 'H';
    statusRow.appendChild(td);
  });
  tbody.appendChild(statusRow);
}

/**
 * Build a 2-D array [stepIdx][frameIdx] = pageNumber | null.
 * Each slot retains its value from the previous step unless replaced.
 *
 * @param {object[]} steps
 * @param {number}   frames
 * @returns {(number|null)[][]}
 */
function buildSlotHistory(steps, frames) {
  const history = [];
  // current slot assignment: slotMap[frameIdx] = page | null
  let slots = new Array(frames).fill(null);

  for (let i = 0; i < steps.length; i++) {
    const s = steps[i];
    if (s.fault) {
      // Find a slot to fill: prefer empty first, then the evicted page's slot
      if (s.evicted !== null) {
        const evictIdx = slots.indexOf(s.evicted);
        if (evictIdx !== -1) slots[evictIdx] = s.added;
      } else {
        // Fill first empty slot
        const emptyIdx = slots.indexOf(null);
        if (emptyIdx !== -1) slots[emptyIdx] = s.added;
      }
    }
    history.push([...slots]);
  }
  return history;
}

/* ─────────────────────────────────────────
   Main Simulation Runner
───────────────────────────────────────── */

function runSimulation() {
  // ── Parse inputs ────────────────────────────────
  const rawString = el('pageString').value.trim();
  const frameCount = parseInt(el('frameCount').value, 10);
  const algorithm = el('algorithm').value;

  // Validate page reference string
  const pages = rawString.split(/\s+/).map(Number);
  if (pages.some(isNaN) || pages.some(p => !Number.isInteger(p) || p < 0) || pages.length === 0) {
    alert('Please enter a valid page reference string (space-separated non-negative integers).');
    return;
  }

  // Validate frame count
  if (isNaN(frameCount) || frameCount < 1 || frameCount > 10) {
    alert('Number of frames must be between 1 and 10.');
    return;
  }

  // ── Run chosen algorithm ─────────────────────────
  const algoMap = { fifo, lru, optimal };
  const algoNames = {
    fifo: 'FIFO',
    lru: 'LRU',
    optimal: 'Optimal',
  };

  const result = algoMap[algorithm](pages, frameCount);

  // ── Update stats ─────────────────────────────────
  setTextContent('statTotal', result.total);
  setTextContent('statFaults', result.faults);
  setTextContent('statHits', result.hits);
  setTextContent('statRate', result.faultRate + '%');

  // ── Render table ──────────────────────────────────
  renderTable(result, algoNames[algorithm]);

  // ── Show results section ─────────────────────────
  el('results').classList.remove('hidden');
  el('results').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

/* ─────────────────────────────────────────
   Event Listeners
───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {
  el('runBtn').addEventListener('click', runSimulation);

  // Allow pressing Enter in the page string input to run simulation
  el('pageString').addEventListener('keydown', e => {
    if (e.key === 'Enter') runSimulation();
  });
});
