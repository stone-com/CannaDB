/**
 * RemoveButton — small icon button for deleting one list item.
 * Keeps remove actions aligned and consistent across all forms.
 */

import { IconButton, Tooltip } from "@mui/material";
import CloseIcon from "@mui/icons-material/Close";

export default function RemoveButton({
  onClick,
  label = "Remove",
  disabled = false,
}) {
  return (
    <Tooltip title={label} arrow>
      <span>
        {/* span wrapper keeps tooltip working when button is disabled */}
        <IconButton
          size="small"
          color="error"
          onClick={onClick}
          disabled={disabled}
          aria-label={label}
          sx={{ width: 34, height: 34 }}
        >
          <CloseIcon sx={{ fontSize: 18 }} />
        </IconButton>
      </span>
    </Tooltip>
  );
}
