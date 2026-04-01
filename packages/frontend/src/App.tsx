import { Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from './components/AppLayout';
import { CanvasPage } from './pages/CanvasPage';
import { DesignPage } from './pages/DesignPage';

function App() {
  return (
    <Routes>
      <Route element={<AppLayout />}>
        <Route path="/" element={<Navigate to="/design" replace />} />
        <Route path="/design" element={<DesignPage />} />
        <Route path="/canvas" element={<CanvasPage />} />
      </Route>
    </Routes>
  );
}

export default App;
