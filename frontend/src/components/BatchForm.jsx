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
  }, []);

function addPlant() {
  if (!selectedStrain || !count) return;
  setPlants([...plants, { strainId: selectedStrain, count: Number(count) }]);
  setSelectedStrain("");
  setCount("");
}

async function handleSubmit(e) {
  e.preventDefault();
  if (!batchNumber || !cloneDate || plants.length === 0) {
    alert("Please complete all required fields.");
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
    if (!response.ok) throw new Error("Batch submit failed");

   alert("Batch submitted successfully!");

  setBatchNumber("");
    setHarvestDate("");
    setCloneDate("");
    setSelectedStrain("");
    setCount("");
    setPlants([]);

    // Handle successful submission (e.g., reset form, show success message)
  } catch (error) {
    console.error("Error submitting batch form:", error);
    alert("Error submitting batch form.");
  }

}

  return (
<div className="form-container">
      <form onSubmit={handleSubmit}>
        <h2>Create New Batch</h2>
        <label className="form-label" htmlFor="batchNumber">
          Batch Number:
        </label>
        <input
          type="text"
          id="batchNumber"
          value={batchNumber}
          onChange={(e) => setBatchNumber(e.target.value)}
        />
        <label className="form-label" htmlFor="cloneDate">
          Clone Date:
        </label>
        <input
          type="date"
          id="cloneDate"
          value={cloneDate}
          onChange={(e) => setCloneDate(e.target.value)}
        />
        <label className="form-label" htmlFor="harvestDate">
          Harvest Date:
        </label>
        <input
          type="date"
          id="harvestDate"
          value={harvestDate}
          onChange={(e) => setHarvestDate(e.target.value)}
        />
     
<hr />
<label className="form-label" htmlFor ="selectedStrain">Strain:</label>
<select
  id="selectedStrain"
  value={selectedStrain}
  onChange={(e) => setSelectedStrain(e.target.value)}
>
  <option value="" placeholder="Select a strain"></option>
  {strains.map((strain) => (
    <option key={strain._id} value={strain._id}>
      {strain.name}
    </option>
  ))}
</select>
<label className="form-label" htmlFor="count">Count:</label>
<input
  type="number"  id="count"
  value={count}
  onChange={(e) => setCount(e.target.value)}
/>
<label className="form-label">Plants:</label>
<button type="button" onClick={addPlant}>
  Add Plant
</button>

<hr />

<h3>Plants Added</h3>

<p>
  Total Plants:{" "}
  {plants.reduce((sum, p) => sum + p.count, 0)}
</p>

{plants.length === 0 && <p>Selected Plants</p>}

<ul>
  {plants.map((p, i) => {
    const strain = strains.find(s => s._id === p.strainId);
    return (
      <li key={i}>
        {strain ? strain.name : "Unknown Strain"} — {p.count}
      <button
          type="button"
          onClick={() => {
            setPlants(plants.filter((_, idx) => idx !== i));
          }}
        >X
        </button>
      </li>
    );
  })}
</ul>

<button type="submit" onClick={handleSubmit}>
  Submit Batch
</button>
      </form>
</div>
  )
}

export default BatchForm;
