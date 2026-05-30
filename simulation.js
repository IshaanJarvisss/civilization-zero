const canvas = document.getElementById('simCanvas');
const ctx = canvas.getContext('2d');

const GRID_SIZE = 35; 
const TILE_SIZE = 20; 
canvas.width = GRID_SIZE * TILE_SIZE;
canvas.height = GRID_SIZE * TILE_SIZE;

let day = 0;
let dayTimer = 0;
const DAY_DURATION = 250; 

let grid = [];
let agents = [];
let animals = [];
let totalBirths = 4;

// REAL-WORLD RESOURCE TIERS
const TILE = { 
    LAND: 0, 
    WATER: 1, 
    BERRIES: 2, 
    WOOD: 3, 
    STONE: 4, 
    HUT: 5, 
    GRAVE: 6 
};

// --- 1. WORLD GENERATION ---
function initWorld() {
    grid = [];
    for (let x = 0; x < GRID_SIZE; x++) {
        grid[x] = [];
        for (let y = 0; y < GRID_SIZE; y++) {
            let type = TILE.LAND;
            let rand = Math.random();
            
            if (rand < 0.06) type = TILE.WATER;       
            else if (rand < 0.12) type = TILE.BERRIES;   
            else if (rand < 0.18) type = TILE.WOOD;      
            else if (rand < 0.22) type = TILE.STONE;     
            
            grid[x][y] = { type: type, originalType: type, tribeOwner: null };
        }
    }

    // Spawn 4 Wild Fauna (Animals that run and breed)
    for (let i = 0; i < 6; i++) {
        animals.push({
            x: Math.floor(Math.random() * GRID_SIZE),
            y: Math.floor(Math.random() * GRID_SIZE),
            energy: 50
        });
    }

    // Genesis of the 4 Human Factions
    let tribeColors = [0, 120, 225, 290]; // Red, Green, Blue, Purple Factions
    let tribeNames = ["Khorne", "Eden", "Atlan", "Styx"];
    
    for (let i = 0; i < 4; i++) {
        agents.push(new Agent(
            Math.floor(Math.random() * GRID_SIZE),
            Math.floor(Math.random() * GRID_SIZE),
            null,
            `Anc_${tribeNames[i]}`,
            tribeColors[i],
            tribeNames[i]
        ));
    }
    logEvent("GENESIS: 4 independent human souls awake in a harsh, unyielding world.");
}

// --- 2. HUMAN BRAIN CODE ---
class Agent {
    constructor(x, y, parent = null, name = "Unnamed", tribeColor = 0, tribeName = "Nomad") {
        this.x = x;
        this.y = y;
        this.name = name;
        this.tribeColor = tribeColor;
        this.tribeName = tribeName;
        this.isFighting = false;

        // INVENTORY (Real Life Inventory Building Blocks)
        this.wood = 0;
        this.stone = 0;
        this.hasHomeBase = false;
        this.homeX = null;
        this.homeY = null;

        if (parent) {
            this.dna = {
                aggression: Math.max(0, Math.min(1, parent.dna.aggression + (Math.random() * 0.16 - 0.08))),
                intelligence: Math.max(0, Math.min(1, parent.dna.intelligence + (Math.random() * 0.16 - 0.08)))
            };
            this.memory = [...parent.memory];
            if (parent.hasHomeBase) {
                this.hasHomeBase = true;
                this.homeX = parent.homeX;
                this.homeY = parent.homeY;
            }
        } else {
            this.dna = { aggression: Math.random(), intelligence: Math.random() };
            this.memory = [];
        }

        this.hunger = 100;
        this.thirst = 100;
        this.age = 0;
    }

    update() {
        this.age++;
        // Metabolism scales with intelligence (smarter tools require slightly more mental fuel)
        this.hunger -= (0.15 + (this.dna.intelligence * 0.05));  
        this.thirst -= 0.25;  
        this.isFighting = false;

        // DEATH MECHANIC -> Creates a Permanent Monument/Grave
        if (this.hunger <= 0 || this.thirst <= 0) {
            if (grid[this.x][this.y].type === TILE.LAND) {
                grid[this.x][this.y].type = TILE.GRAVE; // Leave historic memory
            }
            logEvent(`DIED: ${this.name} of the ${this.tribeName} Clan fell to the elements.`);
            return false; 
        }

        // REAL LIFE LOGIC PRIORITIES
        if (this.thirst < 50) {
            this.seekResource(TILE.WATER);
        } else if (this.hunger < 50) {
            // Smart or Aggressive agents choose to hunt live animals, others seek berries
            if (this.dna.aggression > 0.4 && animals.length > 0) {
                this.huntWildlife();
            } else {
                this.seekResource(TILE.BERRIES);
            }
        } else if (!this.hasHomeBase && this.wood >= 3 && this.stone >= 2) {
            this.buildSettlement();
        } else {
            // Gathering Phase: Build materials for future generations
            if (this.wood < 3) this.seekResource(TILE.WOOD);
            else if (this.stone < 2) this.seekResource(TILE.STONE);
            else if (this.hasHomeBase) this.returnHome();
            else this.wander();
        }

        this.interactWithCurrentTile();

        // Stricter Tribal Multiplication Requirements
        if (this.hunger > 90 && this.thirst > 90 && this.hasHomeBase && Math.random() < 0.003 && agents.length < 35) {
            this.procreate();
        }

        return true; 
    }

    wander() {
        this.x = Math.max(0, Math.min(GRID_SIZE - 1, this.x + Math.floor(Math.random() * 3) - 1));
        this.y = Math.max(0, Math.min(GRID_SIZE - 1, this.y + Math.floor(Math.random() * 3) - 1));
    }

    seekResource(type) {
        let destination = this.memory.find(m => m.type === type);
        
        if (!destination) {
            // Radius scan based on Intelligence DNA
            let visionRange = Math.floor(4 + (this.dna.intelligence * 4));
            for (let dx = -visionRange; dx <= visionRange; dx++) {
                for (let dy = -visionRange; dy <= visionRange; dy++) {
                    let nx = this.x + dx;
                    let ny = this.y + dy;
                    if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                        if (grid[nx][ny].type === type) {
                            destination = { x: nx, y: ny, type: type };
                            this.memory.push(destination);
                            break;
                        }
                    }
                }
            }
        }

        if (destination) {
            this.x += Math.sign(destination.x - this.x);
            this.y += Math.sign(destination.y - this.y);
        } else {
            this.wander();
        }
    }

    huntWildlife() {
        if (animals.length === 0) return;
        // Target nearest animal
        let target = animals[0];
        let minDist = Math.abs(this.x - target.x) + Math.abs(this.y - target.y);
        
        animals.forEach(a => {
            let d = Math.abs(this.x - a.x) + Math.abs(this.y - a.y);
            if (d < minDist) { minDist = d; target = a; }
        });

        if (minDist <= 1) {
            this.isFighting = true;
            this.hunger = Math.min(100, this.hunger + 45); // Slaughter animal for meat energy
            animals = animals.filter(a => a !== target); // Remove prey
            if (Math.random() < 0.08) logEvent(`HUNT: ${this.name} successfully tracked and butchered wild fauna.`);
        } else {
            this.x += Math.sign(target.x - this.x);
            this.y += Math.sign(target.y - this.y);
        }
    }

    returnHome() {
        this.x += Math.sign(this.homeX - this.x);
        this.y += Math.sign(this.homeY - this.y);
    }

    buildSettlement() {
        if (grid[this.x][this.y].type === TILE.LAND) {
            grid[this.x][this.y].type = TILE.HUT;
            grid[this.x][this.y].tribeOwner = this.tribeName;
            this.hasHomeBase = true;
            this.homeX = this.x;
            this.homeY = this.y;
            this.wood -= 3;
            this.stone -= 2;
            logEvent(`RISE OF EMPIRE: ${this.name} founded a permanent tribal homestead for Clan ${this.tribeName}.`);
        }
    }

    interactWithCurrentTile() {
        let current = grid[this.x][this.y];
        
        if (current.type === TILE.BERRIES) {
            this.hunger = 100;
            grid[this.x][this.y].type = TILE.LAND;
        } else if (current.type === TILE.WOOD) {
            this.wood++;
            grid[this.x][this.y].type = TILE.LAND;
        } else if (current.type === TILE.STONE) {
            this.stone++;
            grid[this.x][this.y].type = TILE.LAND;
        }
        
        // Raiding mechanic: If aggressive agent steps on a rival hut, they pillage it
        if (current.type === TILE.HUT && current.tribeOwner !== this.tribeName) {
            if (this.dna.aggression > 0.5) {
                this.isFighting = true;
                this.hunger = Math.min(100, this.hunger + 30);
                logEvent(`WARFARE: ${this.name} raided and sacked the rival village of Clan ${current.tribeOwner}!`);
                if (Math.random() < 0.2) grid[this.x][this.y].type = TILE.LAND; // Burn hut down
            }
        }

        if (this.isNearWater()) this.thirst = 100;
    }

    isNearWater() {
        for (let dx = -1; dx <= 1; dx++) {
            for (let dy = -1; dy <= 1; dy++) {
                let nx = this.x + dx;
                let ny = this.y + dy;
                if (nx >= 0 && nx < GRID_SIZE && ny >= 0 && ny < GRID_SIZE) {
                    if (grid[nx][ny].type === TILE.WATER) return true;
                }
            }
        }
        return false;
    }

    procreate() {
        totalBirths++;
        let childName = `Unit_${totalBirths}`;
        agents.push(new Agent(this.x, this.y, this, childName, this.tribeColor, this.tribeName));
        this.hunger -= 35;
        if (Math.random() < 0.15) logEvent(`POPULATION: Lineage of Clan ${this.tribeName} expands. ${childName} is born.`);
    }
}

// --- 3. RUNTIME CONTROLLER ---
function updateSimulation() {
    dayTimer++;
    if (dayTimer >= DAY_DURATION) {
        day++;
        dayTimer = 0;
        regrowNature();
    }

    // Update Human Agents
    agents = agents.filter(agent => agent.update());

    // Update Wildlife Movements
    animals.forEach(animal => {
        animal.x = Math.max(0, Math.min(GRID_SIZE - 1, animal.x + Math.floor(Math.random() * 3) - 1));
        animal.y = Math.max(0, Math.min(GRID_SIZE - 1, animal.y + Math.floor(Math.random() * 3) - 1));
        // Reproduce wildlife slowly
        if (Math.random() < 0.004 && animals.length < 15) {
            animals.push({ x: animal.x, y: animal.y, energy: 50 });
        }
    });

    // Update Dashboard Elements
    document.getElementById('stat-day').innerText = day;
    document.getElementById('stat-pop').innerText = agents.length;
    document.getElementById('stat-animals').innerText = animals.length;
    
    let activeTribes = new Set(agents.map(a => a.tribeName));
    document.getElementById('stat-tribes').innerText = activeTribes.size;

    if (agents.length === 0) {
        document.getElementById('stat-status').innerText = "ALL CIVILIZATIONS COLLAPSED";
        document.getElementById('stat-status').style.color = "#ff3366";
    }
}

function regrowNature() {
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            let tile = grid[x][y];
            if (tile.type === TILE.LAND && tile.originalType !== TILE.LAND) {
                if (Math.random() < 0.15) { // 15% regrowth probability daily
                    grid[x][y].type = tile.originalType;
                }
            }
        }
    }
}

function logEvent(msg) {
    const logBox = document.getElementById('log-box');
    logBox.innerHTML += `<div>[Day ${day}] ${msg}</div>`;
    logBox.scrollTop = logBox.scrollHeight;
}

// --- 4. ENGINE GRAPHICS MATRIX ---
function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw Complex Environment
    for (let x = 0; x < GRID_SIZE; x++) {
        for (let y = 0; y < GRID_SIZE; y++) {
            let tile = grid[x][y];
            if (tile.type === TILE.WATER) ctx.fillStyle = '#112033'; // River/Oasis
            else if (tile.type === TILE.BERRIES) ctx.fillStyle = '#113c24'; // Foraging fields
            else if (tile.type === TILE.WOOD) ctx.fillStyle = '#2c2214'; // Ancient Woods
            else if (tile.type === TILE.STONE) ctx.fillStyle = '#25252b'; // Mountain Quarries
            else if (tile.type === TILE.HUT) ctx.fillStyle = '#543d2b'; // TRIBAL SETTLEMENT HOMESTEAD
            else if (tile.type === TILE.GRAVE) ctx.fillStyle = '#3c1825'; // HISTORICAL MONUMENT GRAVEYARD
            else ctx.fillStyle = '#09090b'; // Plain Unexplored Dirt
            
            ctx.fillRect(x * TILE_SIZE, y * TILE_SIZE, TILE_SIZE - 1, TILE_SIZE - 1);

            // Give built structures a neat glowing neon outline frame
            if (tile.type === TILE.HUT) {
                ctx.strokeStyle = '#00ffcc';
                ctx.strokeRect(x * TILE_SIZE + 1, y * TILE_SIZE + 1, TILE_SIZE - 3, TILE_SIZE - 3);
            }
        }
    }

    // Draw White Wildlife Entities (Prey running away)
    animals.forEach(animal => {
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(animal.x * TILE_SIZE + TILE_SIZE/3, animal.y * TILE_SIZE + TILE_SIZE/3, TILE_SIZE/3, TILE_SIZE/3);
    });

    // Draw Human Civilization Agents
    agents.forEach(agent => {
        if (agent.isFighting) {
            ctx.fillStyle = '#ff0055'; // Combat flash indicators
            ctx.shadowColor = '#ff0055';
            ctx.shadowBlur = 12;
        } else {
            ctx.fillStyle = `hsl(${agent.tribeColor}, 95%, 55%)`; 
            ctx.shadowColor = `hsl(${agent.tribeColor}, 95%, 55%)`;
            ctx.shadowBlur = 6;
        }
        
        ctx.beginPath();
        ctx.arc(agent.x * TILE_SIZE + TILE_SIZE / 2, agent.y * TILE_SIZE + TILE_SIZE / 2, TILE_SIZE / 3.5, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0; 
    });
}

function runEngineLoop() {
    updateSimulation();
    draw();
    requestAnimationFrame(runEngineLoop);
}

initWorld();
runEngineLoop();
