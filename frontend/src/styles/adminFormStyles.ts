export const adminInputClassNames = {
  inputWrapper: [
    'bg-content1',
    'border',
    'border-default-300',
    'shadow-none',
    'data-[hover=true]:border-default-300',
    'group-data-[focus=true]:bg-content1',
    'group-data-[focus=true]:border-default-300',
    'group-data-[focus=true]:shadow-none',
    'dark:bg-default-100/20',
    'dark:border-default-200/50',
    'dark:data-[hover=true]:border-default-200/100',
    'dark:group-data-[focus=true]:border-default-200/100',
  ].join(' '),
  input: 'placeholder:text-default-500',
};

export const adminTextareaClassNames = {
  inputWrapper: adminInputClassNames.inputWrapper,
  input: adminInputClassNames.input,
};

export const adminSelectClassNames = {
  trigger: [
    'bg-content1',
    'border',
    'border-default-300',
    'shadow-none',
    'data-[hover=true]:border-default-300',
    'data-[open=true]:border-default-300',
    'dark:bg-default-100/20',
    'dark:border-default-200/50',
    'dark:data-[hover=true]:border-default-200/100',
    'dark:data-[open=true]:border-default-200/100',
  ].join(' '),
  value: 'text-default-700 dark:text-default-300',
};
