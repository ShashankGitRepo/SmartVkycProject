import { createContext, useState, useEffect, useContext } from 'react';
import { jwtDecode } from 'jwt-decode';
import axios from 'axios';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const apiUrl = import.meta.env?.VITE_API_URL || "http://localhost:8000";
  axios.defaults.baseURL = apiUrl;

  useEffect(() => {
    const token = localStorage.getItem('token');
    if (token) {
      try {
        const decoded = jwtDecode(token);
        // Store user info and token in state
        setUser({ ...decoded, token });
        // Set default auth header for all future requests
        axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
      } catch (e) {
        console.error("Invalid token found during init:", e);
        logout();
      }
    }
    setLoading(false);
  }, []);

  const login = async (email, password) => {
    // Use FormData because FastAPI's OAuth2PasswordRequestForm expects form-encoded data
    const formData = new FormData();
    formData.append('username', email);
    formData.append('password', password);

    const res = await axios.post('/api/v1/auth/login', formData);
    const { access_token } = res.data;
    
    // Save token
    localStorage.setItem('token', access_token);
    
    // Decode token to get user role immediately
    const decoded = jwtDecode(access_token);
    setUser({ ...decoded, token: access_token });
    
    // Set header for subsequent requests
    axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
    
    return decoded.role;
  };

  const logout = () => {
    localStorage.removeItem('token');
    setUser(null);
    delete axios.defaults.headers.common['Authorization'];
  };

  return (
    <AuthContext.Provider value={{ user, login, logout, loading }}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);