import React, { useState, useEffect, use } from 'react';

function BatchForm() {
    //dropdown state for strains
  const [selectedStrain, setSelectedStrain] = useState("");
 const [batchNumber, setBatchNumber] = useState("");
 const [harvestDate, setHarvestDate] = useState("");
 const [cloneDate, setCloneDate] = useState("");
 const [count, setCount] = useState("");
 const [plants, setPlants] = useState([]);
  const [strains, setStrains] = useState([]);
  useEffect(() => {
    async function fetchStrains() {
      try {
        const response = await fetch("/api/strains");
        const data = await response.json();
        setStrains(data);
      } catch (error) {
        console.error("Error fetching strains:", error);
      }}
     fetchStrains();
  })

function addPlant() {
  if (!selectedStrain || !count) return;
  setPlants([...plants, { strainId: selectedStrain, count }]);
  setSelectedStrain("");
  setCount("");
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!batchNumber || !harvestDate || !cloneDate || plants.length === 0) {
    alert("Don't be silly.");
    return;
  }
  const payload = {
    batchNumber,
    harvestDate,
    cloneDate,
    plants,
  };
  try {
    const response = await fetch("/api/batches", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(payload),
    });
    // Handle successful submission (e.g., reset form, show success message)
  } catch (error) {
    console.error("Error submitting batch form:", error);
    alert("Error submitting batch form.");
  }

}

  return (
      <form>
        <h2>Create New Batch</h2>
        <label htmlFor="batchNumber">
          Batch Number:
        </label>
        <input
          type="text"
          id="batchNumber"
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
        />
        <label htmlFor="cloneDate">
          Clone Date:
        </label>
        <input
          type="date"
          id="cloneDate"
          value={cloneDate}
          onChange={(e) => setCloneDate(e.target.value)}
        />
        <label htmlFor="harvestDate">
          Harvest Date:
        </label>
        <input
          type="date"
          id="harvestDate"
          value={harvestDate}
          onChange={(e) => setHarvestDate(e.target.value)}
        />
<hr />
<label htmlFor ="selectedStrain">Strain:</label>
<select
  id="selectedStrain"
  value={selectedStrain}
  onChange={(e) => setSelectedStrain(e.target.value)}
>
  <option value="" placeholder="Select a strain"></option>
  {strains.map((strain) => (
    <option key={strain.id} value={strain.id}>
      {strain.name}
    </option>
  ))}
</select>
<label htmlFor="count">Count:</label>
<input
  type="number"  id="count"
  value={count}
  onChange={(e) => setCount(e.target.value)}
/>
<button type="button" onClick={addPlant}>
  Add Plant
</button>
<button type="submit" onClick={handleSubmit}>
  Submit Batch
</button>
      </form>
  )
}

export default BatchForm;
