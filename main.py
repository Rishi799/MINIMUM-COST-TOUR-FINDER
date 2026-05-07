import time
import math
import random
from algorithms import branch_and_bound_tsp, held_karp_tsp, christofides_tsp

def generate_points(n, seed=None):
    if seed is not None:
        random.seed(seed)
    return [(random.uniform(0, 100), random.uniform(0, 100)) for _ in range(n)]

def compute_distance_matrix(points):
    n = len(points)
    matrix = [[0.0 for _ in range(n)] for _ in range(n)]
    for i in range(n):
        for j in range(n):
            if i != j:
                dx = points[i][0] - points[j][0]
                dy = points[i][1] - points[j][1]
                matrix[i][j] = math.sqrt(dx*dx + dy*dy)
    return matrix

def run_experiment():
    sizes = [5, 8, 10, 12, 14]
    
    print(f"{'Nodes':<6} | {'Algorithm':<20} | {'Time (s)':<12} | {'Cost':<12} | {'Path/Status'}")
    print("-" * 80)
    
    for n in sizes:
        points = generate_points(n, seed=42+n)
        dist_matrix = compute_distance_matrix(points)
        
        # 1. Branch and Bound
        if n <= 12: # B&B gets very slow beyond 12 nodes due to factorial growth
            start = time.time()
            bb_cost, bb_path = branch_and_bound_tsp(dist_matrix)
            bb_time = time.time() - start
            print(f"{n:<6} | {'Branch & Bound':<20} | {bb_time:<12.5f} | {bb_cost:<12.2f} | {bb_path}")
        else:
            print(f"{n:<6} | {'Branch & Bound':<20} | {'Skipped':<12} | {'-':<12} | (Too slow)")

        # 2. Held-Karp (Dynamic Programming)
        start = time.time()
        hk_cost, hk_path = held_karp_tsp(dist_matrix)
        hk_time = time.time() - start
        print(f"{n:<6} | {'Held-Karp (DP)':<20} | {hk_time:<12.5f} | {hk_cost:<12.2f} | {hk_path}")
        
        # 3. Christofides
        start = time.time()
        ch_cost, ch_path = christofides_tsp(dist_matrix)
        ch_time = time.time() - start
        
        # Calculate error percentage compared to optimal (Held-Karp gives optimal)
        error_pct = ((ch_cost - hk_cost) / hk_cost) * 100
        print(f"{n:<6} | {'Christofides':<20} | {ch_time:<12.5f} | {ch_cost:<12.2f} | Error: {error_pct:.2f}%")
        print("-" * 80)

if __name__ == "__main__":
    print("Running Comparative Analysis of TSP Algorithms...")
    print("Generating Euclidean distance networks to satisfy Triangle Inequality.\n")
    run_experiment()
