import app from './app';

const PORT = 3001; // ensure this matches what frontend points to

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});