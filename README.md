# Minimum Cost Tour Finder For Multi-City Travel Networks

**Department of Artificial Intelligence and Machine Learning**  
**Course Code:** CD343AI  
**Course:** Design and Analysis of Algorithms  

**Student Name/s:** Rhea Parthiban, Rishi Agarwal, Rangappagari John Niranjan  
**Student USN/s:** 1RV24CI097, 1RV24CI099, 1RV24CI096  

---

## 1. Introduction and Relevance of the Project
In modern transportation and logistics systems, optimizing travel routes is essential for minimizing cost, time, and resource usage. One of the most well-known problems in this domain is the Travelling Salesman Problem (TSP), which focuses on finding the shortest possible route that visits a set of cities exactly once and returns to the starting point.

This problem has widespread real-world applications in areas such as delivery systems, airline scheduling, ride-sharing platforms, and supply chain management. With the rapid growth of smart transportation and AI-based navigation systems, efficient route optimization has become increasingly important.

Recent advancements in algorithm design have provided multiple approaches to solving this problem, ranging from exact methods to approximation techniques. However, many existing solutions either suffer from high computational complexity or fail to scale efficiently for large datasets. This project aims to explore and compare multiple algorithmic techniques to solve the minimum cost tour problem effectively. By analyzing different approaches, the project seeks to balance optimality and computational efficiency, making it relevant for both academic study and real-world implementation.

## 2. Problem Statement and Objectives

The problem addressed in this project is to determine the minimum cost tour that visits all given cities exactly once and returns to the origin city.

### Limitations of Existing Approaches
* **Brute-force methods** are computationally infeasible due to factorial complexity.
* **Exact algorithms** may become slow as the number of cities increases.
* **Approximation algorithms** may sacrifice optimality for speed.

### Challenge
There is a need to evaluate and compare different algorithmic strategies to identify solutions that provide an optimal or near-optimal result within a reasonable time frame.

### Objectives
* To implement the **Branch and Bound** algorithm for exact optimization.
* To implement the **Held–Karp algorithm** using Dynamic Programming.
* To implement the **Christofides algorithm** for efficient approximation.
* To compare the algorithms based on: Execution time, Accuracy of the solution, and Scalability with increasing number of cities.
* To analyze the trade-offs between exact and approximation methods.

## 3. Proposed Methodology / Approach

The project adopts a comparative approach by implementing three different algorithms to solve the problem:

### 1. Branch and Bound
**Mechanism:** This method systematically explores all possible paths or tours.  
**Optimization:** It actively eliminates paths that exceed a calculated bound to prune the search space.  
**Trade-offs:** It guarantees an exact, optimal solution, but it can become highly expensive in terms of computation for large datasets.

### 2. Dynamic Programming - Held-Karp Algorithm
**Mechanism:** The Held-Karp algorithm utilizes dynamic programming combined with memoization.  
**Optimization:** It stores intermediate results in memory to prevent the need for redundant computations.  
**Trade-offs:** It significantly reduces time complexity when compared to traditional brute-force methods while still providing an exact, optimal solution.

### 3. Christofides Algorithm
**Mechanism:** This is an approximation algorithm designed to find near-optimal solutions quickly.  
**Optimization:** The algorithm guarantees a solution within 1.5 times the optimal cost, provided the triangle inequality holds.  
**Trade-offs:** It sacrifices complete optimality to achieve high efficiency, making it highly suitable for processing larger datasets.

### Implementation Steps
1. Represent the cities and distances using a graph (adjacency matrix).
2. Implement all three algorithms independently.
3. Provide multiple input datasets with varying sizes.
4. Measure performance metrics such as execution time and tour cost.
5. Compare and analyze the results.
6. Output the optimal or near-optimal route along with total cost.

## 4. Expected Outcomes

The expected outcome of this project is the development of a system capable of computing the minimum cost tour for multiple cities using different algorithmic approaches. 

The project successfully implements three distinct algorithms—Branch and Bound, the Held–Karp algorithm, and the Christofides algorithm—covering both exact and approximation techniques. Through experimentation, a comparative analysis is conducted to evaluate the strengths and weaknesses of each method in terms of execution time, accuracy, and scalability. This will help in identifying the most suitable algorithm depending on the size and constraints of the problem. Additionally, the project will provide practical insights into optimization techniques used widely in real-world routing.
