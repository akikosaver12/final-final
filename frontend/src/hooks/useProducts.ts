import { useState, useEffect } from "react";

const BASE_URL = "http://localhost:5000";

// Tipos según tu esquema real de MongoDB (sin descuentos)
interface BackendProduct {
  _id: string;
  nombre: string;
  descripcion: string;
  precio: number;
  categoria: 'alimento' | 'juguetes' | 'medicamentos' | 'accesorios' | 'higiene' | 'otros';
  imagen?: string;
  stock: number;
  envioGratis: boolean;
  activo: boolean;
  garantia: {
    tiene: boolean;
    meses: number;
    descripcion: string;
  };
  usuario: {
    name: string;
    email: string;
    telefono: string;
  };
  createdAt: string;
  updatedAt: string;
}

// Tipo normalizado para frontend (mantener compatibilidad)
export interface Product extends BackendProduct {
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

        const token = localStorage.getItem("token");

        // Armamos headers dinámicamente
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

        // Normalizamos datos manteniendo toda la información original
        const normalized: Product[] = data
          .filter(p => p.activo) // Solo productos activos
          .map((p) => ({
            // Datos originales completos
            ...p,
            // Campos normalizados para compatibilidad
            id: p._id,
            name: p.nombre,
            description: p.descripcion,
            price: p.precio, // Solo el precio base, sin descuentos
            category: p.categoria,
            image: p.imagen,
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