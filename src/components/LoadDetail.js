import React, { useEffect, useState } from "react";
import { getLoadById, updateLoad } from "../services/loadService";
import { useParams } from "react-router-dom";

export default function LoadDetail() {
  const { id } = useParams();
  const [load, setLoad] = useState(null);

  useEffect(() => {
    fetchLoad();
  }, []);

  const fetchLoad = async () => {
    const data = await getLoadById(id);
    setLoad(data);
  };

  const handleStatusChange = async (deliveryIndex, status) => {
    const updatedDeliveries = [...load.deliveries];
    updatedDeliveries[deliveryIndex].status = status;
    const updatedLoad = await updateLoad(id, { deliveries: updatedDeliveries });
    setLoad(updatedLoad);
  };

  if (!load) return <p>Loading...</p>;

  return (
    <div>
      <h2>Load Detail: {load.loadNumber}</h2>
      <p>Status: {load.status}</p>
      <h3>Deliveries</h3>
      <ul>
        {load.deliveries.map((delivery, idx) => (
          <li key={idx}>
            {delivery.deliveryNumber} - {delivery.status} &nbsp;
            {delivery.status !== "delivered" && (
              <button onClick={() => handleStatusChange(idx, "delivered")}>
                Mark Delivered
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
