export const EQUIPMENT_TYPES = [
  { value: "tool", label: "Tool" },
  { value: "vehicle", label: "Vehicle" },
  { value: "appliance", label: "Appliance" },
  { value: "hvac", label: "HVAC unit" },
  { value: "key", label: "Key" },
  { value: "other", label: "Other" },
] as const;
export type EquipmentType = (typeof EQUIPMENT_TYPES)[number]["value"];

export const EQUIPMENT_STATUSES = [
  { value: "in_service", label: "In service" },
  { value: "in_repair", label: "In repair" },
  { value: "retired", label: "Retired" },
  { value: "lost", label: "Lost or missing" },
] as const;
export type EquipmentStatus = (typeof EQUIPMENT_STATUSES)[number]["value"];

/** One piece of equipment or an asset: a tool, vehicle, appliance, HVAC unit or key. */
export interface Equipment {
  id: string;
  name: string;
  type: EquipmentType;
  /** Serial number, VIN, plate or key tag. */
  identifier: string;
  /** Where it is kept: a truck, a shop, a unit number. */
  location: string;
  /** Who has it. */
  assignedTo: string;
  status: EquipmentStatus;
  purchasedOn: string | null;
  warrantyEndsOn: string | null;
  /** The next service or maintenance date. */
  nextServiceOn: string | null;
  /** Repeat service this many days after it is logged. Absent or null: no repeat. */
  serviceEveryDays?: number | null;
  lastServiceOn?: string | null;
  /** The next inspection or certification date. */
  nextInspectionOn: string | null;
  /** The vendor or shop that services it. */
  serviceVendor: string;
  notes: string;
  createdOn: string;
}
