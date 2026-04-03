import React, { useState } from 'react';

function BatchForm() {
  const [selectedStrain, setSelectedStrain] = useState("");
  return (
    <><form>
          <label>
              Select Strain:
              <select
                  value={selectedStrain}
                  onChange={(e) => setSelectedStrain(e.target.value)}
              >
                  <option value="">-- Select a Strain --</option>
                  {strains.map((strain) => (
                      <option key={strain._id} value={strain._id}>
                          {strain.name}
                      </option>
                  ))}
              </select>
          </label>

      </form><div>BatchForm</div></>
  )
}

export default BatchForm;
