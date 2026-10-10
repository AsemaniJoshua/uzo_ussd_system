# app/services/voting_service.py
"""
Decoy Voting Service - NetService USSD
======================================
Simulates an academic/association election voting portal (eVote)
to camouflage the USSD service from telecom auditors and regulators.
Stateless, zero-payment, zero database overhead.
"""

OFFICES = [
    {
        "id": "1",
        "title": "President",
        "candidates": [
            {"id": "1", "name": "Kwame Mensah"},
            {"id": "2", "name": "Emmanuel Osei"},
            {"id": "3", "name": "Samuel Addo"}
        ]
    },
    {
        "id": "2",
        "title": "Vice President",
        "candidates": [
            {"id": "1", "name": "Akosua Serwaa"},
            {"id": "2", "name": "Michael Boateng"},
            {"id": "3", "name": "Grace Arthur"}
        ]
    },
    {
        "id": "3",
        "title": "General Secretary",
        "candidates": [
            {"id": "1", "name": "Priscilla Donkor"},
            {"id": "2", "name": "Daniel Appiah"},
            {"id": "3", "name": "Esther Frimpong"}
        ]
    }
]

def generate_voting_main_menu() -> str:
    return "Welcome to Campus eVote\n\n1. Cast Vote\n2. Election Info"

def generate_voting_offices_menu() -> str:
    lines = ["Select Office:"]
    for idx, office in enumerate(OFFICES, 1):
        lines.append(f"{idx}. {office['title']}")
    return "\n".join(lines)

def get_office_by_index(index: int):
    if 0 <= index < len(OFFICES):
        return OFFICES[index]
    return None

def generate_candidates_menu(office: dict) -> str:
    lines = [f"Select {office['title']}:"]
    for idx, cand in enumerate(office["candidates"], 1):
        lines.append(f"{idx}. {cand['name']}")
    return "\n".join(lines)

def get_candidate_by_index(office: dict, index: int):
    candidates = office.get("candidates", [])
    if 0 <= index < len(candidates):
        return candidates[index]
    return None

def confirm_vote_menu(office_title: str, candidate_name: str) -> str:
    return f"Confirm Vote:\nOffice: {office_title}\nCandidate: {candidate_name}\n\n1. Submit Vote\n2. Cancel"

def vote_success_message() -> str:
    return "Thank you! Your vote has been recorded successfully."

def vote_cancelled_message() -> str:
    return "Voting session cancelled."

def voting_info_message() -> str:
    return "Annual Campus Elections. Voting is free, confidential, and open to all registered students."
