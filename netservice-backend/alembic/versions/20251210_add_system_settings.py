"""Add system_settings table

Revision ID: 20251210_000002
Revises: 20251210_000001
Create Date: 2025-12-10 00:00:02

"""
from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision = '20251210_000002'
down_revision = '20251210_000001'
branch_labels = None
depends_on = None


def upgrade():
    # Create system_settings table
    op.create_table(
        'system_settings',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('setting_key', sa.String(length=64), nullable=False),
        sa.Column('setting_value', sa.String(length=255), nullable=False),
        sa.Column('updated_at', sa.DateTime(timezone=True), server_default=sa.text('CURRENT_TIMESTAMP'), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    op.create_index(op.f('ix_system_settings_setting_key'), 'system_settings', ['setting_key'], unique=True)
    
    # Insert default value for ussd_restricted (false by default)
    op.execute("INSERT INTO system_settings (setting_key, setting_value) VALUES ('ussd_restricted', 'false')")


def downgrade():
    op.drop_index(op.f('ix_system_settings_setting_key'), table_name='system_settings')
    op.drop_table('system_settings')
