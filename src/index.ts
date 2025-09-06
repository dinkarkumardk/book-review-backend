import express from 'express';

const app = express();
const PORT = 5000;
import userRoutes from './modules/user/user.routes';
import bookRoutes from './modules/book/book.routes';
import reviewRoutes from './modules/review/review.routes';

app.use(express.json());
app.use(userRoutes);
app.use(bookRoutes);
app.use(reviewRoutes);

app.get('/', (req, res) => {
  res.send('BookVerse backend is running!');
});

app.listen(PORT, () => {
  console.log(`Server is listening on port ${PORT}`);
});
