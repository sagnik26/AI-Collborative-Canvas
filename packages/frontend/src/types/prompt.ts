export type PromptMessage = {
  id: string;
  text: string;
  status: 'pending' | 'done' | 'error';
};

