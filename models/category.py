from connector.db import db
from sqlalchemy import Column, Integer, String, ForeignKey, Text, DateTime, func
from sqlalchemy.orm import relationship


class Category(db.Model):
    __tablename__ = "categories"
    category_id = db.Column(db.Integer, primary_key=True, autoincrement=True, nullable=False)
    category_name = db.Column(db.String(120), unique=True, nullable=False)
    status = db.Column(db.String(20), nullable=False, default='active')

    product = relationship("Product", back_populates= "category", lazy=True)

    def __repr__(self):
        return f"<Category {self.category_name} {self.category_id}>"
    
    def to_dict(self):
        return {
            'category_id': self.category_id,
            'category_name': self.category_name,
            'category_status': self.status
        }

    