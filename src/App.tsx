import { Route, Routes } from 'react-router-dom';
import { Layout } from './components/Layout';
import { Home } from './routes/Home';
import { CreateEvent } from './routes/CreateEvent';
import { Created } from './routes/Created';
import { EventPage } from './routes/EventPage';

export function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/new" element={<CreateEvent />} />
        <Route path="/e/:id/created" element={<Created />} />
        <Route path="/e/:id" element={<EventPage />} />
        <Route path="*" element={<Home />} />
      </Routes>
    </Layout>
  );
}
