import itertools
import networkx as nx

# ---------------------------------------------------------
# 1. Branch and Bound
# ---------------------------------------------------------
def branch_and_bound_tsp(dist_matrix):
    n = len(dist_matrix)
    min_cost = float('inf')
    best_path = []
    
    # Precompute min outgoing edge cost for each node to use as a simple lower bound
    min_edges = [min(row[j] for j in range(n) if j != i) for i, row in enumerate(dist_matrix)]

    def bnb_recursive(curr_node, visited, curr_cost, path):
        nonlocal min_cost, best_path
        
        if len(visited) == n:
            total_cost = curr_cost + dist_matrix[curr_node][0]
            if total_cost < min_cost:
                min_cost = total_cost
                best_path = path + [0]
            return
            
        # Calculate a simple lower bound:
        # curr_cost + min outgoing from current node + sum of min outgoing for all unvisited nodes
        # If this is >= min_cost, we can prune
        lower_bound = curr_cost
        unvisited = set(range(n)) - visited
        if unvisited:
            bound_estimate = lower_bound + sum(min_edges[u] for u in unvisited)
            if bound_estimate >= min_cost:
                return

        for next_node in range(n):
            if next_node not in visited:
                visited.add(next_node)
                path.append(next_node)
                bnb_recursive(next_node, visited, curr_cost + dist_matrix[curr_node][next_node], path)
                path.pop()
                visited.remove(next_node)

    bnb_recursive(0, {0}, 0, [0])
    return min_cost, best_path


# ---------------------------------------------------------
# 2. Dynamic Programming - Held-Karp Algorithm
# ---------------------------------------------------------
def held_karp_tsp(dist_matrix):
    n = len(dist_matrix)
    memo = {}

    def visit(curr, visited_mask):
        if visited_mask == (1 << n) - 1:
            return dist_matrix[curr][0], [0]
            
        state = (curr, visited_mask)
        if state in memo:
            return memo[state]

        min_cost = float('inf')
        best_path = []

        for nxt in range(n):
            if not (visited_mask & (1 << nxt)):
                cost, path = visit(nxt, visited_mask | (1 << nxt))
                total_cost = dist_matrix[curr][nxt] + cost
                if total_cost < min_cost:
                    min_cost = total_cost
                    best_path = [nxt] + path

        memo[state] = (min_cost, best_path)
        return min_cost, best_path

    min_cost, path = visit(0, 1)
    return min_cost, [0] + path


# ---------------------------------------------------------
# 3. Christofides Algorithm
# ---------------------------------------------------------
def christofides_tsp(dist_matrix):
    n = len(dist_matrix)
    
    # 1. Create a complete graph
    G = nx.Graph()
    for i in range(n):
        for j in range(i + 1, n):
            G.add_edge(i, j, weight=dist_matrix[i][j])
            
    # 2. Find Minimum Spanning Tree
    mst = nx.minimum_spanning_tree(G, weight='weight')
    
    # 3. Find vertices with odd degree in MST
    odd_degree_nodes = [v for v, d in mst.degree() if d % 2 == 1]
    
    # 4. Find minimum weight perfect matching for odd degree vertices
    # NetworkX's min_weight_matching finds MAX weight by default, so we invert weights
    odd_subgraph = nx.Graph()
    for i in range(len(odd_degree_nodes)):
        for j in range(i + 1, len(odd_degree_nodes)):
            u, v = odd_degree_nodes[i], odd_degree_nodes[j]
            # Negate weight because nx.min_weight_matching actually finds max weight matching if not specified carefully,
            # Wait, nx.min_weight_matching in recent versions minimizes weight if maxcardinality=True
            odd_subgraph.add_edge(u, v, weight=dist_matrix[u][v])
            
    # In newer networkx versions, min_weight_matching computes the minimum weight matching natively
    matching = nx.min_weight_matching(odd_subgraph, weight='weight')
    
    # 5. Combine MST and matching to form a multigraph
    multigraph = nx.MultiGraph()
    multigraph.add_edges_from(mst.edges(data=True))
    for u, v in matching:
        multigraph.add_edge(u, v, weight=dist_matrix[u][v])
        
    # 6. Find Eulerian circuit
    # An Eulerian circuit is guaranteed because all vertices now have even degree
    euler_circuit = list(nx.eulerian_circuit(multigraph, source=0))
    
    # 7. Extract Hamiltonian cycle by removing duplicates (shortcutting)
    visited = set()
    hamiltonian_path = []
    
    for u, v in euler_circuit:
        if u not in visited:
            visited.add(u)
            hamiltonian_path.append(u)
            
    hamiltonian_path.append(hamiltonian_path[0])  # Return to start
    
    # Calculate cost
    total_cost = 0
    for i in range(len(hamiltonian_path) - 1):
        total_cost += dist_matrix[hamiltonian_path[i]][hamiltonian_path[i+1]]
        
    return total_cost, hamiltonian_path
