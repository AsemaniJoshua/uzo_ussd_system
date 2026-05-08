"""Add status, session_id, user_msisdn to served_requests

Revision ID: 20251210_000001
Revises: 
Create Date: 2025-12-10

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251210_000001'
down_revision = 'a507be73df64'
branch_label = None
depends_on = None


def upgrade():
    # Add new columns to served_requests table
    op.add_column('served_requests', sa.Column('status', sa.String(32), nullable=True))
    op.add_column('served_requests', sa.Column('session_id', sa.String(128), nullable=True))
    op.add_column('served_requests', sa.Column('user_msisdn', sa.String(64), nullable=True))


def downgrade():
    # Remove columns if rolling back
    op.drop_column('served_requests', 'user_msisdn')
    op.drop_column('served_requests', 'session_id')
    op.drop_column('served_requests', 'status')
