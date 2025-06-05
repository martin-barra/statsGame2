import { db } from "./firebase.js";
import { ref, get } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-database.js";

async function getScores() {
  const snapshot = await get(ref(db, "scores"));
  if (!snapshot.exists()) return [];
  return Object.entries(snapshot.val()).map(([key, value]) => ({
    ...value,
    key,
  }));
}

function createChart(canvasId, title, labels, data) {
  const ctx = document.getElementById(canvasId).getContext("2d");
  return new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: title,
        data,
        backgroundColor: "rgba(75, 192, 192, 0.6)",
        borderColor: "rgba(75, 192, 192, 1)",
        borderWidth: 1
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

getScores().then(scores => {
  const difficulties = ["random", "easy", "hard"];

  difficulties.forEach(difficulty => {
    // Filtramos los scores por dificultad
    const filtered = scores.filter(s => (s.difficulty || "").toLowerCase() === difficulty);

    if (filtered.length === 0) {
      // Si no hay datos, limpiamos título y gráfico
      document.getElementById(`title-${difficulty}`).textContent = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} (Sin datos)`;
      return;
    }

    // Calculamos stats: mejor jugador, promedio bosses derrotados
    const bestByPlayer = {};
    let totalDefeated = 0;

    filtered.forEach(s => {
      const playerName = s.playerName || "Anónimo";
      const bossesArr = Array.isArray(s.bosses)
        ? s.bosses
        : typeof s.bosses === "string"
          ? s.bosses.split(",").map(b => b.trim())
          : [];

      const defeated = 50 - bossesArr.length;
      totalDefeated += defeated;

      if (!bestByPlayer[playerName] || defeated > bestByPlayer[playerName]) {
        bestByPlayer[playerName] = defeated;
      }
    });

    const labels = Object.keys(bestByPlayer);
    const data = labels.map(name => bestByPlayer[name]);

    // Mejor jugador y promedio
    const maxDefeated = Math.max(...data);
    const indexMax = data.indexOf(maxDefeated);
    const bestPlayer = labels[indexMax];
    const average = (totalDefeated / filtered.length).toFixed(2);

    // Actualizamos título con info extra
    const titleText = `${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)} — Promedio: ${average}, Mejor: ${bestPlayer} (${maxDefeated})`;
    document.getElementById(`title-${difficulty}`).textContent = titleText;

    // Creamos el gráfico
    createChart(`chart-${difficulty}`, "Bosses derrotados", labels, data);
  });

  // ---- Gráfico de habilidades ----
  // Contamos la frecuencia total de cada skill en todos los registros
  const skillCounts = {};

  scores.forEach(s => {
    const skillsArr = Array.isArray(s.skills)
      ? s.skills
      : typeof s.skills === "string"
        ? s.skills.split(",").map(skill => skill.trim())
        : [];

    skillsArr.forEach(skill => {
      if (!skill) return;
      skillCounts[skill] = (skillCounts[skill] || 0) + 1;
    });
  });

  const skillLabels = Object.keys(skillCounts);
  const skillData = skillLabels.map(skill => skillCounts[skill]);

  if (skillLabels.length === 0) {
    document.getElementById("title-skills").textContent = "Uso de Habilidades (Sin datos)";
  } else {
    createChart("chart-skills", "Cantidad de uso de habilidades", skillLabels, skillData);
  }
});
