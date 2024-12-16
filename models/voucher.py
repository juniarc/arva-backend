from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship



class Voucher(db.Model):
    __tablename__ = "voucher"
    voucher_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    voucher_name = db.Column(db.String(120), nullable=False)
    voucher_type = db.Column(db.String(120), nullable=False)
    voucher_value = db.Column(db.Integer, nullable=False)
    start_date = db.Column(db.DateTime(timezone=True), nullable=False)
    end_date = db.Column(db.DateTime(timezone=True), nullable=False)
    shop_id = db.Column(db.Integer, ForeignKey('shops.shop_id', ondelete='CASCADE'), nullable=False)
    shop = relationship("Shop", back_populates="voucher", lazy=True)
    

    def __repr__(self):
        return f'<Voucher {self.voucher_id} {self.voucher_name} {self.voucher_type} {self.voucher_value} {self.start_date} {self.end_date} {self.shop_id}>'
    
    def to_dict(self):
        return {
            'voucher_id': self.voucher_id,
            'voucher_name': self.voucher_name,
            'voucher_type': self.voucher_type,
            'voucher_value': self.voucher_value,
            'start_date': self.start_date,
            'end_date': self.end_date,
            'shop_id': self.shop_id,
        }