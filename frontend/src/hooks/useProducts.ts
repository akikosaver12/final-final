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
  nombre: any;
  _id: any;
  id: string;
  name: string;
  description: string;
  price: number;
  category: string;
  image?: string;
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

        const token = localStorage.getItem("token"); // 👈 aquí va el token
        const response = await fetch(`${BASE_URL}/api/productos`, {
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${token}`,
          },
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
