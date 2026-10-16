// Class list for a text input/select/textarea; also for controls that can't
// use <Input>/<Select> (e.g. a search box with an icon inside).
export const controlClass = (invalid = false) => (
  `w-full rounded-lg bg-base border ${invalid ? 'border-error' : 'border-border'} px-3 py-2 text-sm text-primary `
  + 'placeholder:text-secondary focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30 '
  + 'disabled:opacity-60 disabled:cursor-not-allowed'
);
