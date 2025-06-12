import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

const colorsByDifficulty = {
  random: {
    background: "rgba(138, 43, 226, 0.2)",
    border: "rgba(138, 43, 226, 1)",
    point: "rgba(138, 43, 226, 1)",
  },
  easy: {
    background: "rgba(34, 139, 34, 0.2)",
    border: "rgba(34, 139, 34, 1)",
    point: "rgba(34, 139, 34, 1)",
  },
  hard: {
    background: "rgba(220, 20, 60, 0.2)",
    border: "rgba(220, 20, 60, 1)",
    point: "rgba(220, 20, 60, 1)",
  },
};

const alternatingBackgrounds = [
  "rgba(138, 43, 226, 0.2)",
  "rgba(34, 139, 34, 0.2)",
  "rgba(220, 20, 60, 0.2)",
  "rgba(255, 165, 0, 0.2)",
  "rgba(70, 130, 180, 0.2)",
  "rgba(255, 105, 180, 0.2)",
];

const alternatingBorders = ["rgb(31, 26, 26)"];

let playerChart = null;

async function getScores() {
  const snapshot = await get(ref(db, "scores"));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([key, value]) => ({ ...value, key }));
}

function shuffleArray(array) {
  const arr = array.slice();
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function createChart(canvasId, title, labels, data, colors) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  const bg = shuffleArray(alternatingBackgrounds);
  const bd = shuffleArray(alternatingBorders);
  const backgroundColors = data.map((_, i) => bg[i % bg.length]);
  const borderColors = data.map((_, i) => bd[i % bd.length]);

  return new Chart(ctx, {
    type: "bar",
    data: { labels, datasets: [{ label: title, data, backgroundColor: backgroundColors, borderColor: borderColors, borderWidth: 1 }] },
    options: { responsive: true, scales: { y: { beginAtZero: true } } },
  });
}

getScores().then(scores => {
  // Título principal
  const uniquePlayers = new Set(scores.map(s => (s.playerName || "Anónimo").toLowerCase()));
  document.querySelector("h1").textContent = `Dashboard de RPG Boss Fight (${uniquePlayers.size} jugadores)`;

  // Gráficos por dificultad
  ["random", "easy", "hard"].forEach(difficulty => {
    const filtered = scores.filter(s => (s.difficulty || "").toLowerCase() === difficulty);
    if (filtered.length === 0) {
      document.getElementById(`title-${difficulty}`).textContent =
        `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} (Sin datos)`;
      return;
    }

    let totalDefeated = 0;
    const bestByPlayer = {};

    filtered.forEach(s => {
      const name = s.playerName || "Anónimo";
      const bosses = Array.isArray(s.bosses)
        ? s.bosses
        : typeof s.bosses === "string"
          ? s.bosses.split(",").map(b => b.trim())
          : [];
      const defeated = 50 - bosses.length;
      totalDefeated += defeated;
      if (!bestByPlayer[name] || defeated > bestByPlayer[name]) bestByPlayer[name] = defeated;
    });

    const playerArray = Object.entries(bestByPlayer)
      .map(([name, defeated]) => ({ name, defeated }))
      .sort((a, b) => b.defeated - a.defeated)
      .slice(0, 8);

    const labels = playerArray.map(p => p.name);
    const data = playerArray.map(p => p.defeated);

    const maxDefeated = Math.max(...Object.values(bestByPlayer));
    const bestPlayer = Object.entries(bestByPlayer).find(([, d]) => d === maxDefeated)[0];
    const average = (totalDefeated / filtered.length).toFixed(2);

    document.getElementById(`title-${difficulty}`).textContent =
      `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} (Top 8) — Promedio: ${average}, Mejor: ${bestPlayer} (${maxDefeated})`;

    createChart(`chart-${difficulty}`, "Bosses derrotados", labels, data, colorsByDifficulty[difficulty]);
  });

  // Gráfico de habilidades
  const skillCounts = {};
  scores.forEach(s => {
    const skills = Array.isArray(s.skills)
      ? s.skills
      : typeof s.skills === "string"
        ? s.skills.split(",").map(x => x.trim())
        : [];
    skills.forEach(skill => {
      if (skill) skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
  });

  const skillEntries = Object.entries(skillCounts).sort((a, b) => b[1] - a[1]);
  const skillLabels = skillEntries.map(([s]) => s);
  const skillData = skillEntries.map(([, c]) => c);

  if (skillLabels.length === 0) {
    document.getElementById("title-skills").textContent = "Uso de Habilidades (Sin datos)";
  } else {
    createChart("chart-skills", "Cantidad de uso de habilidades", skillLabels, skillData, colorsByDifficulty.random);
  }

  // Estadísticas de stats y porcentajes globales
  const statKeys = ["vida", "ataqueMelee", "ataqueRango", "defensa", "velocidad", "regenVida", "regenMana"];
  const statsByDifficulty = { random: { count: 0 }, easy: { count: 0 }, hard: { count: 0 } };
  Object.values(statsByDifficulty).forEach(obj => statKeys.forEach(k => (obj[k] = 0)));

  scores.forEach(s => {
    const diff = (s.difficulty || "").toLowerCase();
    if (!statsByDifficulty[diff] || !s.values) return;
    statsByDifficulty[diff].count++;
    statKeys.forEach(k => (statsByDifficulty[diff][k] += Number(s.values[k]) || 0));
  });

  Object.entries(statsByDifficulty).forEach(([diff, data]) => {
    if (data.count > 0) statKeys.forEach(k => (data[k] /= data.count));
  });

  const percentageDatasets = Object.entries(statsByDifficulty)
    .map(([diff, data]) => {
      if (data.count === 0) return null;
      const total = statKeys.reduce((sum, k) => sum + data[k], 0);
      if (total === 0) return null;
      return {
        label: diff.charAt(0).toUpperCase() + diff.slice(1),
        data: statKeys.map(k => (data[k] / total) * 100),
        fill: true,
        backgroundColor: colorsByDifficulty[diff].background,
        borderColor: colorsByDifficulty[diff].border,
        pointBackgroundColor: colorsByDifficulty[diff].point,
        borderWidth: 2,
      };
    })
    .filter(Boolean);

  if (percentageDatasets.length === 0) {
    document.getElementById("title-stats-percent").textContent = "Distribución % de Stats (Sin datos)";
  } else {
    const allPerc = percentageDatasets.flatMap(ds => ds.data);
    const maxPerc = Math.max(...allPerc);
    const dynMax = Math.ceil(maxPerc + 10);
    const step = Math.ceil(dynMax / 5);

    new Chart(document.getElementById("chart-stats-percent"), {
      type: "radar",
      data: { labels: statKeys, datasets: percentageDatasets },
      options: {
        responsive: true,
        scales: { r: { beginAtZero: true, suggestedMax: dynMax, ticks: { stepSize: step } } },
        plugins: { title: { display: true, text: "Distribución porcentual de Stats por Dificultad" } },
      },
    });
  }

  // Gráfico “Stats promedio por dificultad”
  const radarDatasets = Object.entries(statsByDifficulty)
    .map(([diff, data]) => {
      if (data.count === 0) return null;
      return {
        label: diff.charAt(0).toUpperCase() + diff.slice(1),
        data: statKeys.map(k => data[k]),
        fill: true,
        backgroundColor: colorsByDifficulty[diff].background,
        borderColor: colorsByDifficulty[diff].border,
        pointBackgroundColor: colorsByDifficulty[diff].point,
        borderWidth: 2,
      };
    })
    .filter(Boolean);

  if (radarDatasets.length === 0) {
    document.getElementById("title-stats").textContent = "Stats Promedio por Dificultad (Sin datos)";
  } else {
    new Chart(document.getElementById("chart-stats"), {
      type: "radar",
      data: { labels: statKeys, datasets: radarDatasets },
      options: {
        responsive: true,
        scales: {
          r: {
            beginAtZero: true,
            suggestedMax: Math.ceil(Math.max(...radarDatasets.flatMap(ds => ds.data)) + 10),
            ticks: { stepSize: Math.ceil((Math.max(...radarDatasets.flatMap(ds => ds.data)) + 10) / 5) },
          },
        },
        plugins: { title: { display: true, text: "Stats promedio por dificultad" } },
      },
    });
  }

  // Gráfico de “Boss con el que perdiste”
  const firstBossCounts = {};
  scores.forEach(s => {
    const bosses = Array.isArray(s.bosses)
      ? s.bosses
      : typeof s.bosses === "string"
        ? s.bosses.split(",").map(b => b.trim())
        : [];
    const boss = bosses[0];
    if (boss) firstBossCounts[boss] = (firstBossCounts[boss] || 0) + 1;
  });

  const bossEntries = Object.entries(firstBossCounts).sort((a, b) => b[1] - a[1]);
  if (bossEntries.length === 0) {
    document.getElementById("title-first-boss").textContent = "Boss más difícil (Sin datos)";
  } else {
    createChart(
      "chart-first-boss",
      "Boss con el que perdiste",
      bossEntries.map(([b]) => b),
      bossEntries.map(([, c]) => c),
      colorsByDifficulty.hard
    );
  }

  // Buscador por jugador
    // --- Buscador por jugador ---
    document.getElementById("btn-search").addEventListener("click", () => {
      const nameInput = document.getElementById("search-player").value.trim().toLowerCase();
      const resultTitle = document.getElementById("player-result-title");
      const ctx = document.getElementById("chart-player-values").getContext("2d");
  
      // Si ya existe un chart previo, lo destruyo
      if (playerChart) {
        playerChart.destroy();
        playerChart = null;
      }
  
      if (!nameInput) {
        resultTitle.textContent = "Ingresa un nombre válido.";
        return;
      }
  
      // Filtro registros del jugador
      const playerRecords = scores.filter(s => (s.playerName || "").toLowerCase() === nameInput);
      if (playerRecords.length === 0) {
        resultTitle.textContent = `No se encontraron registros para "${nameInput}".`;
        return;
      }
  
      // Dificultades jugadas
      const difficultiesPlayed = [...new Set(playerRecords.map(s => s.difficulty || "desconocido"))];
      resultTitle.textContent = `Jugador "${nameInput}" — Dificultades jugadas: ${difficultiesPlayed.join(", ")}`;
  
      const statKeys = ["vida", "ataqueMelee", "ataqueRango", "defensa", "velocidad", "regenVida", "regenMana"];
      const datasets = [];
  
      // Para cada dificultad, calculo promedios y transformo a %    
      difficultiesPlayed.forEach(difficulty => {
        const recs = playerRecords.filter(s => (s.difficulty || "desconocido") === difficulty && s.values);
        if (recs.length === 0) return;
  
        // Sumo valores
        const totals = statKeys.reduce((acc, k) => ({ ...acc, [k]: 0 }), {});
        recs.forEach(s => statKeys.forEach(k => totals[k] += Number(s.values[k]) || 0));
        // Promedio
        statKeys.forEach(k => (totals[k] /= recs.length));
        const sum = statKeys.reduce((sum, k) => sum + totals[k], 0);
        if (sum === 0) return;
  
        // Paso a %
        const perc = statKeys.map(k => (totals[k] / sum) * 100);
        const c = colorsByDifficulty[difficulty] || {
          background: "rgba(0, 191, 255, 0.2)",
          border: "rgba(0, 191, 255, 1)",
          point:  "rgba(0, 191, 255, 1)"
        };
  
        datasets.push({
          label: `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} (${recs.length} partidas)`,
          data: perc,
          fill: true,
          backgroundColor: c.background,
          borderColor: c.border,
          pointBackgroundColor: c.point,
          borderWidth: 2
        });
      });
  
      if (datasets.length === 0) {
        resultTitle.textContent = `Jugador "${nameInput}" encontrado, pero sin valores registrados.`;
        return;
      }
  
      // Calculo dinámico del max y step
      const allValues = datasets.flatMap(ds => ds.data);
      const maxVal = Math.max(...allValues);
      const dynamicMax = Math.ceil(maxVal + 10);
      const stepSize = Math.ceil(dynamicMax / 5);
  
      // Creo el radar chart para el jugador
      playerChart = new Chart(ctx, {
        type: "radar",
        data: {
          labels: statKeys,
          datasets: datasets
        },
        options: {
          responsive: true,
          scales: {
            r: {
              beginAtZero: true,
              suggestedMax: dynamicMax,
              ticks: { stepSize: stepSize }
            }
          },
          plugins: {
            title: {
              display: true,
              text: "Distribución porcentual de stats por dificultad"
            },
            legend: {
              display: true,
              position: "top"
            }
          }
        }
      });
    });  // ← cierre del addEventListener
  
  }); // ← cierre definitivo de getScores().then(...)
  
// ← Cierre definitivo de getScores().then(...)
