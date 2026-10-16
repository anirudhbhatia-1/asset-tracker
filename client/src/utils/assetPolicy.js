// What an employee agrees to for a client laptop in their care. Shown with
// the laptop's price on the employee's own asset view.
export const CLIENT_LAPTOP_POLICY = [
  'In case of the loss of the laptop, on or off Company premises, due to negligence of the employee, the Company may recover the cost of the laptop from the employee. It is the Company’s discretion to impose further penalties on account of loss of sensitive Company information.',
  'If there is damage on account of the above, the employee may be liable to pay the damages at cost to the Company, or the same may be deducted from their monthly salary.',
];

// The specs worth showing someone about their own device, in display order.
export const SPEC_FIELDS = [
  ['brand', 'Brand'],
  ['model', 'Model'],
  ['processor', 'Processor'],
  ['ram', 'RAM'],
  ['storage', 'Storage'],
  ['screenSize', 'Screen size'],
  ['graphicsCard', 'Graphics'],
  ['os', 'Operating system'],
  ['msOffice', 'MS Office'],
  ['antiVirus', 'Antivirus'],
  ['color', 'Colour'],
];

export const assetSpecs = (asset) => SPEC_FIELDS
  .filter(([key]) => asset?.[key])
  .map(([key, label]) => ({ key, label, value: asset[key] }));

// Price is shown for client assets only; company prices are not shown to employees.
export const showsPrice = (asset) => asset?.assetType === 'client' && asset.costCents != null;
