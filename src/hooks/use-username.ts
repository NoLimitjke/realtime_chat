import { nanoid } from 'nanoid';
import React from 'react';

const ANIMALS = ['wolf', 'hawk', 'bear', 'shark'];

const STORAGE_KEY = 'chat_username';

const genereateName = () => {
  const word = ANIMALS[Math.floor(Math.random()) * ANIMALS.length];
  return `anonymous - ${word}-${nanoid(5)}`;
};

export const useUsername = () => {
  const [username, setUsername] = React.useState('');

  React.useEffect(() => {
    const main = () => {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) {
        setUsername(stored);
        return;
      }

      const genereated = genereateName();
      localStorage.setItem(STORAGE_KEY, genereated);
      setUsername(genereated);
    };

    main();
  }, []);

  return { username };
};
