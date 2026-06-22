import API from "./api";

export const getLoads = async () => {
  const res = await API.get("/loads");
  return res.data;
};

export const getLoadById = async (id) => {
  const res = await API.get(`/loads/${id}`);
  return res.data;
};

export const createLoad = async (loadData) => {
  const res = await API.post("/loads", loadData);
  return res.data;
};

export const updateLoad = async (id, updateData) => {
  const res = await API.put(`/loads/${id}`, updateData);
  return res.data;
};
