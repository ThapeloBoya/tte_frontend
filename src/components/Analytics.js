import React, { useEffect, useState } from "react";
import { getLoads } from "../services/loadService";
import { Bar } from "react-chartjs-2";
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";

ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

export default function Analytics() {
  const [loads, setLoads] = useState([]);

  useEffect(() => {
    fetchLoads();
  }, []);

  const fetchLoads = async () => {
    const data = await getLoads();
    setLoads(data);
  };

  const statusCounts = loads.reduce(
    (acc, load) => {
      acc[load.status] = (acc[load.status] || 0) + 1;
      return acc;
    },
    { waiting: 0, "in transit": 0, completed: 0, canceled: 0 }
  );

  const chartData = {
    labels: Object.keys(statusCounts),
    datasets: [
      {
        label: "# of Loads",
        data: Object.values(statusCounts),
        backgroundColor: ["orange", "blue", "green", "red"],
      },
    ],
  };

  return (
    <div>
      <h2>Load Analytics</h2>
      <Bar data={chartData} />
    </div>
  );
}
