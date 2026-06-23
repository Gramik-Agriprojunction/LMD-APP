/** Pass selected farmer back to CreateSoilOrder without pushing a duplicate screen. */
let _pending = null;

export const setPendingSelectedFarmer = (farmer) => {
  _pending = farmer;
};

export const consumePendingSelectedFarmer = () => {
  const farmer = _pending;
  _pending = null;
  return farmer;
};
