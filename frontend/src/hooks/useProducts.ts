import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:5000";

// 👉 Tipos según backend (MongoDB)
interface BackendProduct {
  _id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: string;
  imagen?: string;
}

// 👉 Tipo normalizado para frontend
export interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
  nombre: string;
  _id: string;
}

export function useProducts() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchProducts = async () => {
      try {
        setLoading(true);
        setError(null);

        const token = localStorage.getItem("token");

        // 👇 armamos headers dinámicamente
        const headers: HeadersInit = {
          "Content-Type": "application/json",
        };

        if (token) {
          headers.Authorization = `Bearer ${token}`;
        }

        const response = await fetch(`${BASE_URL}/api/productos`, {
          headers,
        });

        if (!response.ok) {
          throw new Error(`Error ${response.status}: ${response.statusText}`);
        }

        const data: BackendProduct[] = await response.json();

        // 👉 Normalizamos datos
        const normalized: Product[] = data.map((p) => ({
          id: p._id,
          name: p.nombre,
          description: p.descripcion,
          price: p.precio,
          category: p.categoria,
          image: p.imagen,
          nombre: p.nombre,
          _id: p._id,
        }));

        setProducts(normalized);
      } catch (err: any) {
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };

    fetchProducts();
  }, []);

  return { products, loading, error };
}
